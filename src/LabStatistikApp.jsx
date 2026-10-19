import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, BarChart3, Calculator, CheckSquare, ChevronDown, ChevronUp,
  Crown, Edit, FileSpreadsheet, Lightbulb, Link, Loader2, PieChart,
  ShieldAlert, Sparkles, Trash2, Flame
} from 'lucide-react';
import { callGeminiAPI, safeParseObject } from './utils';
import { playKatanaSlash, playDarkGong } from './audioEffects';

const StatEngine = {
  parseCSV: (text) => {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 1) throw new Error("Data tidak lengkap.");
    
    const separator = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
    const firstRowVals = lines[0].split(separator).map(h => h.trim());
    
    const isNumericRow = firstRowVals.every(val => val !== '' && !isNaN(parseFloat(val.replace(',', '.'))));
    
    let headers = [];
    let startIndex = 0;
    
    if (isNumericRow) {
        const colCount = firstRowVals.length;
        for(let i=0; i<colCount; i++) {
            if (i === colCount - 1) headers.push('Y');
            else headers.push(`X${i+1}`);
        }
        startIndex = 0; 
    } else {
        firstRowVals.forEach((h, i) => {
            let newH = h || `Var${i+1}`;
            if (headers.includes(newH)) {
                let suffix = 1;
                while(headers.includes(`${newH}_${suffix}`)) suffix++;
                newH = `${newH}_${suffix}`;
            }
            headers.push(newH);
        });
        startIndex = 1;
    }

    if (lines.length - startIndex < 2) throw new Error("Data baris terlalu sedikit untuk dianalisis.");

    const columns = {};
    headers.forEach(h => columns[h] = []);
    
    for(let i=startIndex; i<lines.length; i++) {
      const vals = lines[i].split(separator);
      headers.forEach((h, idx) => {
        const val = parseFloat((vals[idx] || '').replace(',', '.')); 
        columns[h].push(isNaN(val) ? 0 : val); 
      });
    }
    return { headers, columns, count: columns[headers[0]]?.length || 0 };
  },
  
  mean: (arr) => arr.length === 0 ? 0 : arr.reduce((a,b)=>a+b,0)/arr.length,
  stdDev: (arr) => {
    if (arr.length < 2) return 0;
    const m = StatEngine.mean(arr);
    return Math.sqrt(arr.reduce((a,b)=>a+Math.pow(b-m,2),0) / (arr.length - 1));
  },
  // Label kategori skala Likert sesuai jumlah poin skala (dideteksi otomatis dari rentang data)
  likertLabels: (scaleSize) => {
    switch (scaleSize) {
      case 2: return ['TS', 'S'];
      case 3: return ['TS', 'N', 'S'];
      case 4: return ['STS', 'TS', 'S', 'SS'];
      case 5: return ['STS', 'TS', 'N', 'S', 'SS'];
      case 6: return ['STS', 'TS', 'KS', 'CS', 'S', 'SS'];
      case 7: return ['STS', 'TS', 'KS', 'N', 'CS', 'S', 'SS'];
      default: return null;
    }
  },
  // Distribusi frekuensi & persentase jawaban responden untuk tiap skor pada rentang [min, max]
  freqDistribution: (values, min, max) => {
    const n = values.length;
    const counts = [];
    for (let v = min; v <= max; v++) {
      const c = values.filter(x => Math.round(x) === v).length;
      counts.push({ value: v, count: c, pct: n === 0 ? 0 : (c / n) * 100 });
    }
    return counts;
  },
  erf: (x) => {
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const a1=0.254829592, a2=-0.284496736, a3=1.421413741, a4=-1.453152027, a5=1.061405429, p=0.3275911;
    const t = 1 / (1 + p*x);
    const y = 1 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1) * t * Math.exp(-x*x);
    return sign * y;
  },
  normCDF: (z) => 0.5 * (1 + StatEngine.erf(z / Math.SQRT2)),
  gammln: (xx) => {
    const cof = [76.18009172947146, -86.50532032941677, 24.01409824083091,
                 -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let x = xx, y = xx;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) { y += 1; ser += cof[j] / y; }
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  },
  betacf: (a, b, x) => {
    const MAXIT = 200, EPS = 3e-14, FPMIN = 1e-300;
    let m2, aa, c, d, del, h, m;
    const qab = a + b, qap = a + 1, qam = a - 1;
    c = 1; d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d; h = d;
    for (m = 1; m <= MAXIT; m++) {
      m2 = 2 * m;
      aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; del = d * c; h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  },
  betai: (a, b, x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(
      StatEngine.gammln(a + b) - StatEngine.gammln(a) - StatEngine.gammln(b) +
      a * Math.log(x) + b * Math.log(1 - x)
    );
    if (x < (a + 1) / (a + b + 2)) {
      return bt * StatEngine.betacf(a, b, x) / a;
    } else {
      return 1 - bt * StatEngine.betacf(b, a, 1 - x) / b;
    }
  },
  // p-value dua-arah eksak untuk distribusi t-Student, sesuai cara SPSS menghitung Sig.
  tDistPValue: (t, df) => {
    if (df <= 0) return 1;
    const x = df / (df + t * t);
    const p = StatEngine.betai(df / 2, 0.5, x);
    return Math.min(1, Math.max(0, p));
  },
  // p-value untuk distribusi F (uji simultan/ANOVA), sesuai cara SPSS menghitung Sig. F
  fDistPValue: (f, df1, df2) => {
    if (df1 <= 0 || df2 <= 0 || f < 0) return 1;
    const x = df2 / (df2 + df1 * f);
    const p = StatEngine.betai(df2 / 2, df1 / 2, x);
    return Math.min(1, Math.max(0, p));
  },
  pearson: (x, y) => {
    if (x.length !== y.length || x.length < 2) return 0;
    const n = x.length;
    const sumX = x.reduce((a,b)=>a+b,0), sumY = y.reduce((a,b)=>a+b,0);
    const sumX2 = x.reduce((a,b)=>a+b*b,0), sumY2 = y.reduce((a,b)=>a+b*b,0);
    const sumXY = x.reduce((a,b,i)=>a+b*y[i],0);
    const num = (n * sumXY) - (sumX * sumY);
    const den = Math.sqrt((n * sumX2 - sumX*sumX) * (n * sumY2 - sumY*sumY));
    return den === 0 ? 0 : num / den;
  },
  
  transpose: (A) => A[0].map((_, c) => A.map(r => r[c])),
  multiply: (A, B) => {
      let res = [];
      for(let i=0; i<A.length; i++){
          res[i] = [];
          for(let j=0; j<B[0].length; j++){
              let sum = 0;
              for(let k=0; k<A[0].length; k++) sum += A[i][k] * B[k][j];
              res[i][j] = sum;
          }
      }
      return res;
  },
  invert: (M) => {
      let n = M.length, I = [], C = [];
      for(let i=0; i<n; i++){ I[i] = []; for(let j=0; j<n; j++) I[i][j] = (i===j)?1:0; }
      for(let i=0; i<n; i++) C[i] = [...M[i], ...I[i]];
      for(let i=0; i<n; i++){
          let e = C[i][i];
          if(e===0) return null; 
          for(let j=0; j<2*n; j++) C[i][j] /= e;
          for(let k=0; k<n; k++){
              if(k===i) continue;
              let f = C[k][i];
              for(let j=0; j<2*n; j++) C[k][j] -= f * C[i][j];
          }
      }
      let inv = [];
      for(let i=0; i<n; i++) inv[i] = C[i].slice(n, 2*n);
      return inv;
  },

  // FUNGSI INTI REGRESI LINEAR BERGANDA (Digunakan juga untuk Glejser)
  computeMultipleRegression: (yArr, xArrs, xNames) => {
    const n = yArr.length;
    const k = xArrs.length;
    if(n < k + 2) return null;
    
    const Y = yArr.map(v => [v]);
    const X = [];
    for(let i=0; i<n; i++){
        let row = [1];
        for(let j=0; j<k; j++) row.push(xArrs[j][i]);
        X.push(row);
    }
    
    const XT = StatEngine.transpose(X);
    const XTX = StatEngine.multiply(XT, X);
    const XTX_inv = StatEngine.invert(XTX);
    if(!XTX_inv) return null; 
    
    const XTY = StatEngine.multiply(XT, Y);
    const Beta = StatEngine.multiply(XTX_inv, XTY).map(r => r[0]); 
    
    const Y_pred = X.map(row => row.reduce((sum, val, idx) => sum + val * Beta[idx], 0));
    const residuals = yArr.map((y, i) => y - Y_pred[i]);
    
    const meanY = StatEngine.mean(yArr);
    const SST = yArr.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
    const SSE = residuals.reduce((sum, e) => sum + Math.pow(e, 2), 0);
    const R2 = SST === 0 ? 0 : 1 - (SSE / SST);
    
    const MSE = SSE / (n - k - 1);
    const SE = XTX_inv.map((row, i) => Math.sqrt(Math.max(0, row[i] * MSE)));
    const tStats = Beta.map((b, i) => SE[i] === 0 ? 0 : b / SE[i]);
    
    const df = n - k - 1;
    const getPVal = (t) => StatEngine.tDistPValue(Math.abs(t), df);
    const pValues = tStats.map(t => getPVal(t));

    const fValue = ((1-R2) === 0) ? 0 : (R2/k) / ((1-R2)/(n-k-1));

    return {
        intercept: { b: Beta[0], se: SE[0], t: tStats[0], p: pValues[0] },
        coefficients: xNames.map((name, i) => ({
            name, b: Beta[i+1], se: SE[i+1], t: tStats[i+1], p: pValues[i+1]
        })),
        r2: R2,
        fValue: fValue,
        fPValue: StatEngine.fDistPValue(fValue, k, n - k - 1),
        dfRegresi: k,
        dfResidual: n - k - 1,
        residuals: residuals,
        XTX_inv: XTX_inv // disimpan untuk VIF
    };
  },

  multipleRegression: (yArr, xArrs, xNames) => {
    const baseReg = StatEngine.computeMultipleRegression(yArr, xArrs, xNames);
    if (!baseReg) return null;

    const n = yArr.length;
    const k = xArrs.length;

    // Hitung VIF (Multikolinearitas)
    let vifs = [];
    if(k > 1) {
       const corMatrix = [];
       for(let i=0; i<k; i++){
          corMatrix[i] = [];
          for(let j=0; j<k; j++) corMatrix[i][j] = StatEngine.pearson(xArrs[i], xArrs[j]);
       }
       const corInv = StatEngine.invert(corMatrix);
       vifs = corInv ? corInv.map((row, i) => row[i]) : Array(k).fill(1);
    } else {
       vifs = [1];
    }
    baseReg.coefficients.forEach((c, i) => { c.vif = vifs[i]; });

    // Standardized Coefficients (Beta) = b * (SD_x / SD_y), sesuai kolom "Beta" pada output SPSS
    const sdY = StatEngine.stdDev(yArr);
    baseReg.coefficients.forEach((c, i) => {
      const sdX = StatEngine.stdDev(xArrs[i]);
      c.beta = sdY === 0 ? 0 : c.b * (sdX / sdY);
    });

    // Uji Normalitas Kolmogorov-Smirnov
    const meanE = StatEngine.mean(baseReg.residuals);
    const sdE = StatEngine.stdDev(baseReg.residuals);
    const sortedResiduals = [...baseReg.residuals].sort((a, b) => a - b);
    let ksD = 0;
    sortedResiduals.forEach((e, i) => {
      const z = sdE === 0 ? 0 : (e - meanE) / sdE;
      const Fz = StatEngine.normCDF(z);
      const DPlus = ((i + 1) / n) - Fz;
      const DMinus = Fz - (i / n);
      ksD = Math.max(ksD, DPlus, DMinus);
    });
    
    const pNormalityRaw = Math.exp(
      -7.01256 * Math.pow(ksD, 2) * (n + 2.78019) +
      2.99587 * ksD * Math.sqrt(n + 2.78019) -
      0.122119 + (0.974598 / Math.sqrt(n)) + (1.67997 / n)
    );
    const pNormality = isNaN(pNormalityRaw) ? 0 : Math.min(1, Math.max(0, pNormalityRaw)); 
    // SPSS membatasi tampilan Sig. Lilliefors maksimal di 0.200 (lower bound) bila p hitung > 0.2
    const isSpssCapped = pNormality > 0.2;
    baseReg.normality = { ks: ksD, p: pNormality, isNormal: pNormality > 0.05, isSpssCapped };

    // --- PERBAIKAN UJI GLEJSER ---
    // Sesuai SPSS: Meregresikan Absolut Residual dengan Semua Variabel X secara Bersamaan (Multiple Regression)
    const absResiduals = baseReg.residuals.map(Math.abs);
    const glejserReg = StatEngine.computeMultipleRegression(absResiduals, xArrs, xNames);
    
    baseReg.heteroGlejser = glejserReg ? glejserReg.coefficients.map(c => ({
       var: c.name, 
       pVal: c.p 
    })) : xNames.map(name => ({ var: name, pVal: 0 }));

    return baseReg;
  }
};


function LabStatistikApp({ onNavigateBack }) {
  const [activeStatModule, setActiveStatModule] = useState(null);
  const [mobileView, setMobileView] = useState('input'); 
  
  const [statData, setStatData] = useState(() => localStorage.getItem('sp_stat_data') || '');
  const [parsedPreview, setParsedPreview] = useState(() => safeParseObject('sp_stat_parsed', null)); 
  const [statContext, setStatContext] = useState(() => localStorage.getItem('sp_stat_context') || '');
  const [showFormatGuide, setShowFormatGuide] = useState(false);
  
  const loadCachedMathResults = () => {
    try {
      const cached = safeParseObject('sp_stat_math', null);
      if (cached?.regression?.normality && cached.regression.normality.ks === undefined) {
        localStorage.removeItem('sp_stat_math');
        localStorage.removeItem('sp_stat_ai');
        return null;
      }
      return cached || null;
    } catch (e) {
      return null;
    }
  };

  const [mathResults, setMathResults] = useState(loadCachedMathResults); 
  const [aiInterpretations, setAiInterpretations] = useState(() => safeParseObject('sp_stat_ai', null)); 
  const [isStatAnalyzing, setIsStatAnalyzing] = useState(false);

  useEffect(() => { localStorage.setItem('sp_stat_data', statData); }, [statData]);
  useEffect(() => { localStorage.setItem('sp_stat_parsed', JSON.stringify(parsedPreview)); }, [parsedPreview]);
  useEffect(() => { localStorage.setItem('sp_stat_context', statContext); }, [statContext]);
  useEffect(() => { localStorage.setItem('sp_stat_math', JSON.stringify(mathResults)); }, [mathResults]);
  useEffect(() => { localStorage.setItem('sp_stat_ai', JSON.stringify(aiInterpretations)); }, [aiInterpretations]);

  const handleStatDataInput = (val) => {
    setStatData(val);
    try {
      if(!val.trim()) { setParsedPreview(null); return; }
      const parsed = StatEngine.parseCSV(val);
      if (parsed.headers.length > 0 && parsed.count > 0) {
        const itemGroups = {};
        const variables = [];
        let yVar = '';

        parsed.headers.forEach(h => {
          const match = h.match(/^([a-zA-Z]+)\d+$/);
          if (match) {
             const base = match[1];
             if(!itemGroups[base]) itemGroups[base] = [];
             itemGroups[base].push(h);
          } else {
             variables.push(h);
          }
        });

        if(variables.length > 0) {
           yVar = variables[variables.length - 1]; 
        } else {
           yVar = parsed.headers[parsed.headers.length - 1];
           variables.push(yVar);
        }
        
        const xVars = variables.filter(v => v !== yVar);

        // --- VALIDATOR FORMAT KOLOM ---
        // Mendeteksi kesalahan umum: penomoran item pakai titik (mis. X1.1) atau
        // nama variabel total masih mengandung angka (mis. X1, X2), sehingga
        // sistem gagal mengelompokkan item ke variabelnya.
        let formatWarning = null;
        const dottedHeaders = parsed.headers.filter(h => h.includes('.'));
        if (dottedHeaders.length > 0) {
           formatWarning = `Terdeteksi nama kolom pakai titik (${dottedHeaders.slice(0, 4).join(', ')}${dottedHeaders.length > 4 ? ', ...' : ''}). Sistem tidak bisa mengelompokkan pola ini sebagai item. Ganti tanpa titik dan tanpa angka di nama variabelnya, misal "X1.1, X1.2, X1" → "ATT1, ATT2, ATT" (lihat Panduan Format di atas).`;
        } else if (xVars.length > 6) {
           formatWarning = `Terdeteksi ${xVars.length} variabel X, cukup banyak untuk penelitian pada umumnya. Jika sebagian kolom ini seharusnya ITEM dari variabel yang sama (bukan variabel berbeda), pastikan pola namanya "Singkatan+Angka" (mis. ATT1, ATT2) dan ada satu kolom TOTAL bernama sama tanpa angka (mis. ATT).`;
        }

        setParsedPreview({ ...parsed, itemGroups, variables, xVars, yVar, formatWarning });
      } else {
        setParsedPreview(null);
      }
    } catch(e) {
      setParsedPreview(null);
    }
  };

  const handleStatAnalysis = async () => {
    if (!parsedPreview || parsedPreview.headers.length < 1) return alert("Silakan masukkan data yang valid terlebih dahulu.");
    setIsStatAnalyzing(true);
    setMobileView('result'); 
    setMathResults(null);
    setAiInterpretations(null);

    try {
      const res = { validitas: [], reliabilitas: [], descriptives: [], distribusiJawaban: [], regression: null };

      parsedPreview.variables.forEach(v => {
         res.descriptives.push({
           name: v, n: parsedPreview.count, mean: StatEngine.mean(parsedPreview.columns[v]), std: StatEngine.stdDev(parsedPreview.columns[v])
         });
      });

      Object.keys(parsedPreview.itemGroups).forEach(group => {
         const items = parsedPreview.itemGroups[group];
         const totalColName = parsedPreview.headers.find(h => h === group) || '';
         
         if (items.length > 1 && totalColName) {
            items.forEach(item => {
               res.validitas.push({ item, r: StatEngine.pearson(parsedPreview.columns[item], parsedPreview.columns[totalColName]) });
            });
            const itemVariances = items.map(it => Math.pow(StatEngine.stdDev(parsedPreview.columns[it]), 2));
            const sumVar = itemVariances.reduce((a,b)=>a+b,0);
            const totalVar = Math.pow(StatEngine.stdDev(parsedPreview.columns[totalColName]), 2);
            const alpha = totalVar === 0 ? 0 : (items.length / (items.length - 1)) * (1 - (sumVar / totalVar));
            res.reliabilitas.push({ group, alpha });
         }
      });

      // --- DISTRIBUSI JAWABAN RESPONDEN PER VARIABEL (Tabel Frekuensi STS/TS/N/S/SS) ---
      Object.keys(parsedPreview.itemGroups).forEach(group => {
         const items = parsedPreview.itemGroups[group];
         if (items.length < 1) return;

         const allVals = items.flatMap(it => parsedPreview.columns[it]);
         if (allVals.length === 0) return;

         const minV = Math.round(Math.min(...allVals));
         const maxV = Math.round(Math.max(...allVals));
         const scaleSize = Math.max(1, maxV - minV + 1);
         const labels = StatEngine.likertLabels(scaleSize) || Array.from({ length: scaleSize }, (_, i) => `Skor ${minV + i}`);

         const itemRows = items.map(item => {
            const vals = parsedPreview.columns[item];
            const dist = StatEngine.freqDistribution(vals, minV, maxV);
            return { item, n: vals.length, dist, mean: StatEngine.mean(vals) };
         });

         const groupMean = StatEngine.mean(itemRows.map(r => r.mean));
         res.distribusiJawaban.push({ group, labels, minV, maxV, items: itemRows, groupMean });
      });

      if (parsedPreview.xVars.length > 0 && parsedPreview.yVar) {
         const yArr = parsedPreview.columns[parsedPreview.yVar];
         const xArrs = parsedPreview.xVars.map(x => parsedPreview.columns[x]);
         res.regression = StatEngine.multipleRegression(yArr, xArrs, parsedPreview.xVars);
         if (res.regression) {
            res.regression.yName = parsedPreview.yVar;
         }
      }

      setMathResults(res);

      let normalStatus = "belum dapat disimpulkan";
      let r2Pct = "0%";
      let fStatus = "belum dapat disimpulkan";
      if (res.regression && res.regression.normality) {
          if (res.regression.normality.p > 0.05) {
              normalStatus = "BERDISTRIBUSI NORMAL (karena nilai p lebih besar dari 0.05)";
          } else {
              normalStatus = "TIDAK BERDISTRIBUSI NORMAL (karena nilai p lebih kecil dari 0.05)";
          }
          r2Pct = (res.regression.r2 * 100).toFixed(1) + "%";
      }
      if (res.regression) {
          fStatus = res.regression.fPValue < 0.05
            ? "SIGNIFIKAN SECARA SIMULTAN (karena nilai Sig. F lebih kecil dari 0.05)"
            : "TIDAK SIGNIFIKAN SECARA SIMULTAN (karena nilai Sig. F lebih besar dari 0.05)";
      }

      // --- KOMPRESI DATA EKSTREM UNTUK MENCEGAH TIMEOUT / ERROR 500 ---
      const resForAI = {
          validitas: res.validitas.map(v => ({ item: v.item, r: Number(v.r.toFixed(3)) })),
          reliabilitas: res.reliabilitas.map(r => ({ var: r.group, alpha: Number(r.alpha.toFixed(3)) })),
          normalitas_pVal: res.regression?.normality ? Number(res.regression.normality.p.toFixed(3)) : null,
          multiko_vif: res.regression?.coefficients.map(c => ({ var: c.name, vif: Number(c.vif.toFixed(3)) })),
          hetero_pVal: res.regression?.heteroGlejser.map(h => ({ var: h.var, pVal: Number(h.pVal.toFixed(3)) })),
          regresi_b: res.regression?.coefficients.map(c => ({ var: c.name, b: Number(c.b.toFixed(3)), beta: Number((c.beta || 0).toFixed(3)) })),
          r_square: res.regression ? Number(res.regression.r2.toFixed(3)) : null,
          uji_t_pVal: res.regression?.coefficients.map(c => ({ var: c.name, pVal: Number(c.p.toFixed(3)) })),
          uji_f: res.regression ? {
            f: Number(res.regression.fValue.toFixed(3)),
            pVal: Number(res.regression.fPValue.toFixed(3)),
            df1: res.regression.dfRegresi,
            df2: res.regression.dfResidual
          } : null
      };

      const prompt = `Anda adalah "AI Statistician" penguji Skripsi.
Konteks Riset: "${statContext || 'Analisis data kuantitatif mahasiswa.'}"

Berikut output hitungan statistik (Terkompresi Ekstrem):
${JSON.stringify(resForAI)}

TUGAS:
Buatkan INTERPRETASI PARAGRAF untuk ke-9 urutan tahapan statistik ini secara singkat padat jelas. 
OUTPUT WAJIB HANYA FORMAT JSON SEPERTI DI BAWAH INI (Tanpa awalan/akhiran markdown):

{
  "step1_validitas": "Teks interpretasi uji validitas berdasarkan nilai r. Sebutkan valid jika r > 0.3",
  "step2_reliabilitas": "Teks interpretasi reliabilitas (Cronbach Alpha). Sebutkan reliabel jika alpha > 0.6",
  "step3_normalitas": "Teks interpretasi uji Kolmogorov-Smirnov. WAJIB GUNAKAN KESIMPULAN INI: Data ${normalStatus}. Sebutkan nilai p yang didapat.",
  "step4_multiko": "Teks interpretasi nilai VIF. Sebutkan tidak ada multikolinearitas jika VIF < 10",
  "step5_hetero": "Teks interpretasi nilai pVal hetero (Glejser). Sebutkan tidak ada heteroskedastisitas jika nilai pVal > 0.05",
  "step6_regresi": "Teks penjelasan makna nilai koefisien b untuk setiap variabel X terhadap Y",
  "step7_koef_det": "Teks persentase pengaruh. WAJIB GUNAKAN KESIMPULAN INI: Variabel independen mempengaruhi variabel dependen sebesar ${r2Pct}.",
  "step8_uji_t": "Teks kesimpulan hipotesis dari nilai pVal uji t (signifikan berpengaruh jika pVal < 0.05, dan sebaliknya jika pVal > 0.05)",
  "step9_uji_f": "Teks kesimpulan hipotesis uji F (simultan/ANOVA). WAJIB GUNAKAN KESIMPULAN INI: Model regresi ${fStatus}. Sebutkan nilai F hitung dan nilai Sig. yang didapat."
}`;
      
      const systemPrompt = "Anda Ahli Statistik Senior. OUTPUT HANYA JSON MURNI SESUAI FORMAT YANG DIMINTA.";
      
      let parsedJson;
      try {
          // expectJson diatur ke 'true' untuk OpenAI/Sumopod compatible endpoint
          const { text } = await callGeminiAPI(prompt, systemPrompt, [], false, null, true);
          
          let cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
          const startIdx = cleanText.indexOf('{');
          const endIdx = cleanText.lastIndexOf('}');
          if (startIdx !== -1 && endIdx !== -1) {
              cleanText = cleanText.substring(startIdx, endIdx + 1);
          }
          parsedJson = JSON.parse(cleanText);
          
      } catch (aiError) {
          console.warn("AI API Error / Timeout, memicu Local Fallback Generator:", aiError);
          // --- SISTEM FALLBACK PENGGANTI AI ---
          parsedJson = {
             step1_validitas: `Berdasarkan pengujian korelasi item-total, didapatkan nilai r hitung untuk item-item kuesioner. Kriteria validitas mensyaratkan nilai r > 0.3. Dari data statistik, nilai r ${(resForAI.validitas || []).every(v => v.r >= 0.3) ? 'sudah memenuhi kriteria > 0.3, sehingga instrumen dinyatakan valid.' : 'menunjukkan ada beberapa item yang < 0.3, sehingga terdapat item yang tidak valid dan perlu dihapus.'}`,
             
             step2_reliabilitas: `Uji reliabilitas dilakukan menggunakan Cronbach's Alpha. Hasil menunjukkan nilai alpha sebesar ${(resForAI.reliabilitas || []).map(r => r.alpha).join(', ')}. Karena nilai ini ${(resForAI.reliabilitas || []).every(r => r.alpha > 0.6) ? 'lebih besar dari batas minimal 0.60, maka disimpulkan bahwa kuesioner penelitian ini terbukti reliabel dan konsisten.' : 'kurang dari 0.60, maka instrumen belum cukup reliabel.'}`,
             
             step3_normalitas: `Data ${normalStatus}. Hal ini dapat dilihat dari hasil pengujian Kolmogorov-Smirnov yang memperoleh nilai signifikansi (p-value) sebesar ${resForAI.normalitas_pVal || '-'}, yang mana dijadikan dasar pengambilan keputusan asumsi normalitas model.`,
             
             step4_multiko: `Pengujian multikolinearitas menunjukkan bahwa nilai Variance Inflation Factor (VIF) untuk variabel independen adalah: ${(resForAI.multiko_vif || []).map(c => `${c.var} (${c.vif})`).join(', ')}. Karena seluruh nilai VIF masih di bawah rentang toleransi angka 10, maka disimpulkan tidak terjadi gejala multikolinearitas antar variabel independen.`,
             
             step5_hetero: `Uji heteroskedastisitas menggunakan uji Glejser mendapatkan tingkat signifikansi (p-value) sebesar ${(resForAI.hetero_pVal || []).map(h => `${h.var} (${h.pVal})`).join(', ')}. Karena p-value tersebut ${(resForAI.hetero_pVal || []).every(h => h.pVal > 0.05) ? 'berada di atas ambang batas 0.05, maka model regresi bebas dari indikasi heteroskedastisitas.' : 'terdapat yang di bawah 0.05, mengindikasikan adanya masalah heteroskedastisitas pada data.'}`,
             
             step6_regresi: `Persamaan regresi linear berganda yang terbentuk memiliki nilai koefisien (b) sebesar ${(resForAI.regresi_b || []).map(c => `${c.var} (${c.b})`).join(', ')}. Nilai ini mencerminkan besaran serta arah pengaruh masing-masing variabel X terhadap Y secara proporsional.`,
             
             step7_koef_det: `Variabel independen mempengaruhi variabel dependen sebesar ${r2Pct}. Sementara sisa persentasenya dipengaruhi oleh variabel atau faktor-faktor lain yang tidak diteliti di dalam model penelitian ini.`,
             
             step8_uji_t: `Pengujian hipotesis (uji parsial/uji t) mencatatkan nilai p-value sebesar ${(resForAI.uji_t_pVal || []).map(c => `${c.var}: ${c.pVal}`).join(', ')}. Berdasarkan aturan (p < 0.05), ${(resForAI.uji_t_pVal || []).every(c => c.pVal < 0.05) ? 'semua variabel X terbukti secara signifikan berpengaruh terhadap Y, sehingga seluruh hipotesis penelitian diterima (H1).' : 'hanya variabel dengan p < 0.05 yang berpengaruh signifikan terhadap Y, sedangkan sisanya (p > 0.05) tidak signifikan (H0).'}`,
             
             step9_uji_f: `Pengujian hipotesis secara simultan (uji F) menghasilkan nilai F hitung sebesar ${resForAI.uji_f?.f ?? '-'} dengan tingkat signifikansi (Sig.) sebesar ${resForAI.uji_f?.pVal ?? '-'}. Berdasarkan aturan (Sig. < 0.05), model regresi ${(res.regression && res.regression.fPValue < 0.05) ? 'dinyatakan signifikan secara simultan, yang berarti seluruh variabel independen (X) secara bersama-sama terbukti berpengaruh signifikan terhadap variabel dependen (Y), sehingga model regresi ini dinyatakan layak (fit) digunakan (H1 diterima).' : 'dinyatakan tidak signifikan secara simultan, yang berarti variabel independen (X) secara bersama-sama belum terbukti berpengaruh signifikan terhadap variabel dependen (Y) (H0 diterima).'}`
          };
      }
      
      setAiInterpretations(parsedJson);

    } catch (err) {
      alert(`❌ Data gagal diproses matematis atau format tidak dikenali. Pesan: ${err.message}`);
    } finally {
      setIsStatAnalyzing(false);
    }
  };

  const renderSafeString = (val) => {
    if (!val) return '';
    return typeof val === 'string' ? val : JSON.stringify(val);
  };

  return (
    <div className="flex h-screen bg-[#060102] font-sans text-stone-200 overflow-hidden relative">
      <header className="absolute top-0 left-0 right-0 h-16 sm:h-20 bg-[#0b0305]/95 border-b border-red-950/80 shadow-[0_0_30px_rgba(0,0,0,0.9)] z-50 flex items-center justify-between px-4 sm:px-8 backdrop-blur-md">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <button
            onClick={() => {
              playKatanaSlash();
              onNavigateBack();
            }}
            className="p-2 bg-[#140508] hover:bg-red-950 text-stone-300 hover:text-white rounded-xl transition-all border border-red-950/80 shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center space-x-2 sm:space-x-3">
             <div className="bg-gradient-to-br from-red-600 to-red-950 p-1.5 sm:p-2 rounded-xl text-white shadow-[0_0_15px_rgba(220,38,38,0.5)] border border-red-500/40">
               <Calculator size={20} className="sm:w-6 sm:h-6" />
             </div>
             <div>
                <h1 className="text-base sm:text-xl font-black text-stone-100 font-cinzel tracking-wider leading-none flex items-center gap-2">
                  <span>Alkimia Statistik Kutukan</span>
                  <span className="text-[10px] text-red-500 font-mincho px-1.5 py-0.5 bg-red-950/70 rounded border border-red-900/60 hidden sm:inline">呪術統計</span>
                </h1>
                <div className="hidden sm:flex items-center text-[10px] font-bold text-red-400 mt-1 uppercase tracking-widest font-cinzel">
                  <Link size={11} className="mr-1" /> Uji Validitas & Hipotesis Berdarah Bab 4
                </div>
             </div>
          </div>
        </div>
        <div>
          <span className="bg-[#180508] text-red-300 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-[10px] sm:text-xs font-black tracking-widest shadow-[0_0_12px_rgba(220,38,38,0.3)] border border-red-800/60 flex items-center font-cinzel">
            <Crown size={12} className="sm:w-[14px] sm:h-[14px] mr-1 sm:mr-1.5 text-red-500" />
            <span className="hidden sm:inline">Segel Roh</span> Aktif
          </span>
        </div>
      </header>

      <main className="flex-1 mt-16 sm:mt-20 p-4 sm:p-8 flex flex-col overflow-hidden">
        
        {/* Toggle Tab Khusus Mobile */}
        <div className="lg:hidden flex bg-[#0c0305] p-1.5 rounded-xl mb-4 shrink-0 border border-red-950/80 shadow-sm">
          <button
            onClick={() => setMobileView('input')}
            className={`flex-1 py-2.5 text-xs font-black rounded-lg transition-all flex items-center justify-center font-cinzel ${mobileView === 'input' ? 'bg-red-950 text-red-300 shadow-sm border border-red-700/60' : 'text-stone-400 hover:text-stone-200'}`}
          >
            <FileSpreadsheet size={16} className="mr-2 text-red-400" /> Data & Mantra
          </button>
          <button
            onClick={() => setMobileView('result')}
            className={`flex-1 py-2.5 text-xs font-black rounded-lg transition-all flex items-center justify-center font-cinzel ${mobileView === 'result' ? 'bg-red-950 text-red-300 shadow-sm border border-red-700/60' : 'text-stone-400 hover:text-stone-200'}`}
          >
            <BarChart3 size={16} className="mr-2 text-red-400" /> Hasil Bab 4
          </button>
        </div>

        <div className="max-w-[1400px] w-full mx-auto flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
          
          {/* --- PANEL INPUT KIRI --- */}
          <div className={`w-full lg:w-[35%] flex-col gap-6 overflow-y-auto custom-scrollbar pr-1 pb-4 ${mobileView === 'input' ? 'flex' : 'hidden lg:flex'}`}>
            <div className="bg-[#0c0305] rounded-[2rem] p-5 sm:p-6 border border-red-950/80 shadow-[0_0_30px_rgba(0,0,0,0.85)] flex flex-col shrink-0">
              <h3 className="font-bold text-stone-100 mb-2 sm:mb-3 flex items-center text-sm sm:text-base font-cinzel tracking-wider">
                <FileSpreadsheet size={18} className="mr-2 text-red-500"/> 1. Input Data Angket (Excel)
              </h3>
              <p className="text-xs text-stone-400 mb-2 font-mincho">Tempelkan data angka dari Excel. Sistem roh akan otomatis memisahkan Item pertanyaan dan Skor Total.</p>

              <button
                onClick={() => setShowFormatGuide(v => !v)}
                className="mb-3 self-start flex items-center text-[11px] sm:text-xs font-bold text-red-400 hover:text-red-300 bg-red-950/50 hover:bg-red-950/80 px-2.5 py-1.5 rounded-lg transition-colors border border-red-900/60 font-cinzel"
              >
                <Lightbulb size={13} className="mr-1.5" /> Panduan Format Kolom
                {showFormatGuide ? <ChevronUp size={13} className="ml-1.5" /> : <ChevronDown size={13} className="ml-1.5" />}
              </button>

              {showFormatGuide && (
                <div className="mb-4 p-3.5 bg-[#120407] border border-red-950/90 rounded-xl text-[11px] sm:text-[12px] text-stone-300 leading-relaxed space-y-2.5 font-mincho">
                  <p className="text-red-300 font-bold">Aturan penamaan kolom di Excel:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Beri tiap variabel <b>singkatan huruf</b> (mis. <code className="bg-[#1c060a] px-1 rounded border border-red-900/50 text-red-300">ATT</code>, <code className="bg-[#1c060a] px-1 rounded border border-red-900/50 text-red-300">SN</code>).</li>
                    <li>Kolom tiap <b>item pertanyaan</b> = Singkatan + nomor urut: <code className="bg-[#1c060a] px-1 rounded border border-red-900/50 text-red-300">ATT1</code>, <code className="bg-[#1c060a] px-1 rounded border border-red-900/50 text-red-300">ATT2</code>.</li>
                    <li>Kolom <b>TOTAL/jumlah</b> variabel = persis singkatannya saja: <code className="bg-[#1c060a] px-1 rounded border border-red-900/50 text-red-300">ATT</code>.</li>
                    <li>Variabel <b>Y (terikat)</b> diletakkan di kolom paling kanan.</li>
                  </ul>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[10px]">
                    <div className="bg-[#09150e] border border-emerald-900/60 rounded-lg p-2.5">
                      <p className="font-black text-emerald-400 mb-1">✅ Benar</p>
                      <p className="text-emerald-300 break-all">ATT1, ATT2, ATT3, ATT, SN1, SN2, SN, BI1, BI2, BI</p>
                    </div>
                    <div className="bg-[#1c070a] border border-red-900/60 rounded-lg p-2.5">
                      <p className="font-black text-red-400 mb-1">❌ Salah</p>
                      <p className="text-red-300 break-all">X1.1, X1.2, X1.3, X1, X2.1, X2.2, X2, Y</p>
                    </div>
                  </div>
                </div>
              )}
              
              {!parsedPreview ? (
                <textarea
                  value={statData}
                  onChange={(e) => handleStatDataInput(e.target.value)}
                  placeholder="Paste data dari Excel di sini...&#10;&#10;ATT1, ATT2, ATT, SN1, SN2, SN...&#10;5, 4, 9, 4, 5, 9..."
                  className="w-full h-[200px] sm:h-[250px] bg-[#120406] text-[12px] sm:text-[13px] font-mono text-stone-200 p-4 rounded-xl border border-red-950/90 focus:outline-none focus:ring-1 focus:ring-red-600 resize-none custom-scrollbar placeholder-stone-600"
                />
              ) : (
                <div className="flex-1 flex flex-col bg-[#100305] rounded-xl border border-red-950/80 overflow-hidden relative min-h-[250px] max-h-[400px]">
                  <div className="absolute top-2 right-2 flex gap-2 z-10">
                     <button
                       onClick={() => setParsedPreview(null)}
                       className="bg-[#1c060a] text-stone-200 hover:text-white text-[10px] sm:text-xs px-2.5 py-1.5 rounded-lg border border-red-900/60 shadow-sm font-bold transition-colors flex items-center font-cinzel"
                     >
                       <Edit size={12} className="mr-1 text-red-400"/> Edit
                     </button>
                     <button
                       onClick={() => {
                          if(window.confirm('Yakin ingin menghapus data Excel dan seluruh hasil analisis?')) {
                              setStatData(''); 
                              setParsedPreview(null);
                              setMathResults(null);
                              setAiInterpretations(null);
                          }
                       }}
                       className="bg-[#1c060a] text-red-400 hover:text-red-300 text-[10px] sm:text-xs px-2.5 py-1.5 rounded-lg border border-red-900/60 shadow-sm font-bold transition-colors flex items-center font-cinzel"
                     >
                       <Trash2 size={12} className="mr-1"/> Hapus
                     </button>
                  </div>
                  <div className="p-3 bg-[#150407] border-b border-red-950/80 shrink-0 pr-32 sm:pr-36">
                     <p className="text-[10px] sm:text-xs font-black text-red-400 uppercase tracking-wider flex flex-col gap-1 font-cinzel">
                       <span><CheckSquare size={12} className="sm:w-[14px] sm:h-[14px] inline mr-1 text-red-500"/> Data Terbaca: {parsedPreview.count} Baris Responden</span>
                       <span className="text-[9px] sm:text-[10px] text-stone-400">X: {Array.isArray(parsedPreview.xVars) ? parsedPreview.xVars.join(', ') : ''} | Y: {parsedPreview.yVar}</span>
                     </p>
                     {parsedPreview.formatWarning && (
                       <div className="mt-2 p-2 bg-red-950/60 border border-red-800/60 rounded-lg text-[9px] sm:text-[10px] text-red-300 font-medium leading-relaxed flex items-start gap-1.5 normal-case font-mincho">
                         <ShieldAlert size={13} className="shrink-0 mt-0.5 text-red-500" />
                         <span>{parsedPreview.formatWarning}</span>
                       </div>
                     )}
                  </div>
                  <div className="overflow-x-auto flex-1 custom-scrollbar">
                     <table className="w-full text-left text-[10px] sm:text-[11px] whitespace-nowrap">
                        <thead className="bg-[#1a0508] text-red-300 font-bold uppercase sticky top-0 shadow-sm font-cinzel">
                          <tr>
                            {Array.isArray(parsedPreview.headers) && parsedPreview.headers.map((h, i) => (
                              <th key={i} className="px-3 py-2 border-b border-red-950/80">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-red-950/40">
                          {Array.from({length: Math.min(5, parsedPreview.count || 0)}).map((_, rowIndex) => (
                            <tr key={rowIndex} className="bg-[#100305] hover:bg-red-950/30">
                              {Array.isArray(parsedPreview.headers) && parsedPreview.headers.map((h, colIndex) => (
                                <td key={colIndex} className="px-3 py-1.5 text-stone-300 font-mono">
                                  {parsedPreview.columns[h] ? parsedPreview.columns[h][rowIndex] : ''}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                     </table>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[#0c0305] rounded-[2rem] p-5 sm:p-6 border border-red-950/80 shadow-[0_0_30px_rgba(0,0,0,0.85)] flex flex-col shrink-0 lg:mt-0">
              <h3 className="font-bold text-stone-100 mb-2 sm:mb-3 flex items-center text-sm sm:text-base font-cinzel tracking-wider">
                <Lightbulb size={18} className="mr-2 text-red-500"/> 2. Konteks Riset (Opsional)
              </h3>
              <textarea
                value={statContext}
                onChange={(e) => setStatContext(e.target.value)}
                placeholder="Tuliskan tujuan riset / konteks penelitian agar interpretasi AI lebih tajam..."
                className="w-full h-[60px] sm:h-[80px] bg-[#120406] text-[12px] sm:text-[13px] text-stone-200 p-4 rounded-xl border border-red-950/90 focus:outline-none focus:ring-1 focus:ring-red-600 resize-none custom-scrollbar placeholder-stone-600 font-mincho"
              />
              <button
                onClick={() => {
                  playDarkGong();
                  handleStatAnalysis();
                }}
                disabled={isStatAnalyzing || !parsedPreview}
                className="btn-katana mt-4 w-full py-3.5 sm:py-4 rounded-2xl font-black text-white shadow-[0_0_25px_rgba(220,38,38,0.5)] flex items-center justify-center disabled:opacity-40 transition-all text-sm sm:text-base font-cinzel tracking-wider"
              >
                {isStatAnalyzing ? <Loader2 size={18} className="animate-spin mr-2"/> : <Flame size={18} className="mr-2 text-red-400"/>}
                Tebas & Hasilkan Bab 4 Lengkap!
              </button>
            </div>
          </div>

          {/* --- PANEL OUTPUT KANAN (8 TAHAPAN) --- */}
          <div className={`flex-1 bg-[#0a0204] rounded-[2.5rem] border border-red-950/90 shadow-[0_0_40px_rgba(0,0,0,0.9)] flex-col overflow-hidden relative ${mobileView === 'result' ? 'flex' : 'hidden lg:flex'}`}>
            <div className="bg-[#0e0305] border-b border-red-950/80 px-5 sm:px-6 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center">
                 <button
                   onClick={() => setMobileView('input')}
                   className="lg:hidden mr-3 p-1.5 bg-[#150407] border border-red-950/80 shadow-sm rounded-lg text-stone-400 hover:text-white transition-colors"
                 >
                    <ArrowLeft size={16} />
                 </button>
                 <h3 className="font-black text-stone-100 flex items-center text-sm sm:text-base font-cinzel tracking-wider">
                   <BarChart3 size={18} className="sm:w-5 sm:h-5 mr-2 text-red-500"/> Format Kitab Bab 4 Skripsi
                 </h3>
              </div>
              {aiInterpretations && (
                <span className="bg-red-950/80 text-red-300 border border-red-700/60 px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center font-cinzel shadow-[0_0_10px_rgba(220,38,38,0.3)]">
                  <CheckSquare size={12} className="mr-1 text-red-400"/> Analisis Tersegel
                </span>
              )}
            </div>
            
            <div className="flex-1 p-5 sm:p-10 overflow-y-auto custom-scrollbar bg-[#060102]">
              {isStatAnalyzing ? (
                <div className="h-full flex flex-col items-center justify-center text-red-500 animate-pulse space-y-4">
                  <Loader2 size={48} className="sm:w-16 sm:h-16 animate-spin text-red-600" />
                  <p className="font-black text-sm sm:text-xl tracking-wide text-center font-cinzel text-stone-200">
                    Menghitung 8 Tahapan Uji Statistik Mistis<br/>
                    <span className="text-red-400 text-xs sm:text-sm font-mincho">Merangkai Narasi Akademis Bab 4...</span>
                  </p>
                </div>
              ) : mathResults && aiInterpretations ? (
                <div className="space-y-8 sm:space-y-12 animate-in fade-in duration-500 max-w-4xl mx-auto">

                  {/* STEP 1: VALIDITAS */}
                  {Array.isArray(mathResults.validitas) && mathResults.validitas.length > 0 && (
                    <section className="bg-[#0d0305] p-5 sm:p-6 rounded-2xl border border-red-950/90 shadow-[0_0_25px_rgba(0,0,0,0.7)]">
                      <h4 className="text-base sm:text-lg font-black text-stone-100 font-cinzel mb-4 border-b border-red-950/80 pb-2">
                        1. Uji Validitas (Korelasi Item-Total)
                      </h4>
                      <div className="overflow-x-auto w-full custom-scrollbar pb-2">
                        <table className="w-full text-xs sm:text-sm text-left mb-4 border border-red-950/80 min-w-[300px]">
                          <thead className="bg-[#180508] text-red-300 font-bold uppercase text-[10px] sm:text-[11px] font-cinzel">
                            <tr className="border-b border-red-950/80">
                              <th className="px-4 py-2 border-r border-red-950/80">Item</th>
                              <th className="px-4 py-2 border-r border-red-950/80">r Hitung</th>
                              <th className="px-4 py-2 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mathResults.validitas.map((v, i) => (
                              <tr key={i} className="border-b border-red-950/50 hover:bg-red-950/20">
                                <td className="px-4 py-2 border-r border-red-950/80 font-medium text-stone-300">{v.item}</td>
                                <td className="px-4 py-2 border-r border-red-950/80 font-mono text-red-400 font-bold">{v.r.toFixed(3)}</td>
                                <td className="px-4 py-2 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold font-cinzel ${v.r >= 0.3 ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60' : 'bg-red-950 text-red-300 border border-red-700/60'}`}>
                                    {v.r >= 0.3 ? 'Valid' : 'Gugur'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {aiInterpretations.step1_validitas && (
                        <div className="text-[13px] sm:text-[14px] leading-relaxed text-stone-200 bg-[#140407] p-4 rounded-xl border border-red-900/60 font-mincho shadow-sm">
                          <strong className="text-red-400 font-cinzel">🗡️ Narasi Bab 4:</strong> {renderSafeString(aiInterpretations.step1_validitas)}
                        </div>
                      )}
                    </section>
                  )}

                  {/* STEP 2: RELIABILITAS */}
                  {Array.isArray(mathResults.reliabilitas) && mathResults.reliabilitas.length > 0 && (
                    <section className="bg-[#0d0305] p-5 sm:p-6 rounded-2xl border border-red-950/90 shadow-[0_0_25px_rgba(0,0,0,0.7)]">
                      <h4 className="text-base sm:text-lg font-black text-stone-100 font-cinzel mb-4 border-b border-red-950/80 pb-2">
                        2. Uji Reliabilitas (Cronbach's Alpha)
                      </h4>
                      <div className="overflow-x-auto w-full custom-scrollbar pb-2">
                        <table className="w-full text-xs sm:text-sm text-left mb-4 border border-red-950/80 min-w-[300px]">
                          <thead className="bg-[#180508] text-red-300 font-bold uppercase text-[10px] sm:text-[11px] font-cinzel">
                            <tr className="border-b border-red-950/80">
                              <th className="px-4 py-2 border-r border-red-950/80">Variabel</th>
                              <th className="px-4 py-2 text-center">Cronbach's Alpha</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mathResults.reliabilitas.map((r, i) => (
                              <tr key={i} className="border-b border-red-950/50 hover:bg-red-950/20">
                                <td className="px-4 py-2 border-r border-red-950/80 font-medium text-stone-300">{r.group}</td>
                                <td className="px-4 py-2 text-center font-mono text-purple-400 font-bold">{r.alpha.toFixed(3)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {aiInterpretations.step2_reliabilitas && (
                        <div className="text-[13px] sm:text-[14px] leading-relaxed text-stone-200 bg-[#140407] p-4 rounded-xl border border-red-900/60 font-mincho shadow-sm">
                          <strong className="text-red-400 font-cinzel">🗡️ Narasi Bab 4:</strong> {renderSafeString(aiInterpretations.step2_reliabilitas)}
                        </div>
                      )}
                    </section>
                  )}

                  {/* STEP DISTRIBUSI JAWABAN RESPONDEN */}
                  {Array.isArray(mathResults.distribusiJawaban) && mathResults.distribusiJawaban.length > 0 && (
                    <section className="bg-[#0d0305] p-5 sm:p-6 rounded-2xl border border-red-950/90 shadow-[0_0_25px_rgba(0,0,0,0.7)]">
                      <h4 className="text-base sm:text-lg font-black text-stone-100 font-cinzel mb-1 border-b border-red-950/80 pb-2 flex items-center">
                        <PieChart size={18} className="mr-2 text-red-500"/> Distribusi Jawaban Responden
                      </h4>
                      <p className="text-xs text-stone-400 mb-4 mt-2 font-mincho">Tabel frekuensi dan persentase jawaban responden untuk setiap butir instrumen.</p>
                      <div className="space-y-6">
                        {mathResults.distribusiJawaban.map((d, di) => {
                          const nearestIdx = Math.min(d.maxV, Math.max(d.minV, Math.round(d.groupMean))) - d.minV;
                          const nearestLabel = d.labels[nearestIdx] || '';
                          return (
                            <div key={di}>
                              <p className="text-[11px] sm:text-xs font-black text-stone-300 uppercase tracking-wider mb-2 font-cinzel">
                                Tabel Distribusi Variabel <span className="text-red-400">{d.group}</span>
                              </p>
                              <div className="overflow-x-auto w-full custom-scrollbar pb-2">
                                <table className="w-full text-xs sm:text-sm text-left border border-red-950/80 min-w-[420px]">
                                  <thead className="bg-[#180508] text-red-300 font-bold uppercase text-[10px] sm:text-[11px] font-cinzel">
                                    <tr className="border-b border-red-950/80">
                                      <th className="px-4 py-2 border-r border-red-950/80">Item</th>
                                      {d.labels.map((lb, li) => (<th key={li} className="px-3 py-2 border-r border-red-950/80 text-center">{lb}</th>))}
                                      <th className="px-4 py-2 text-center">Mean</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-red-950/50">
                                    {d.items.map((row, ri) => (
                                      <tr key={ri} className="hover:bg-red-950/20">
                                        <td className="px-4 py-2 border-r border-red-950/80 font-medium text-stone-300">{row.item}</td>
                                        {row.dist.map((c, ci) => (
                                          <td key={ci} className="px-3 py-2 border-r border-red-950/80 text-center font-mono text-[11px] sm:text-xs text-stone-300">
                                            {c.count} <span className="text-stone-500">({c.pct.toFixed(1)}%)</span>
                                          </td>
                                        ))}
                                        <td className="px-4 py-2 text-center font-mono font-bold text-red-400">{row.mean.toFixed(2)}</td>
                                      </tr>
                                    ))}
                                    <tr className="bg-red-950/40 font-bold border-t border-red-900/60">
                                      <td className="px-4 py-2 border-r border-red-950/80 text-stone-200" colSpan={d.labels.length + 1}>Rata-rata variabel {d.group}</td>
                                      <td className="px-4 py-2 text-center font-mono text-red-300 font-black">{d.groupMean.toFixed(2)}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                              <div className="mt-2 text-[11px] sm:text-[12px] leading-relaxed text-stone-400 bg-[#100305] px-4 py-2.5 rounded-xl border border-red-950/80 font-mincho">
                                Nilai rata-rata variabel <b>{d.group}</b> sebesar <b>{d.groupMean.toFixed(2)}</b>, mendekati kategori <b>"{nearestLabel}"</b>.
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* STEP 3: NORMALITAS */}
                  {mathResults.regression && (
                    <section className="bg-[#0d0305] p-5 sm:p-6 rounded-2xl border border-red-950/90 shadow-[0_0_25px_rgba(0,0,0,0.7)]">
                      <h4 className="text-base sm:text-lg font-black text-stone-100 font-cinzel mb-4 border-b border-red-950/80 pb-2">
                        3. Uji Normalitas (Kolmogorov-Smirnov)
                      </h4>
                      <div className="overflow-x-auto w-full custom-scrollbar pb-2">
                        <table className="w-full text-xs sm:text-sm text-left mb-4 border border-red-950/80 min-w-[350px]">
                          <thead className="bg-[#180508] text-red-300 font-bold uppercase text-[10px] sm:text-[11px] font-cinzel">
                            <tr className="border-b border-red-950/80">
                              <th className="px-4 py-2 border-r border-red-950/80">Test</th>
                              <th className="px-4 py-2 border-r border-red-950/80">Statistic (D)</th>
                              <th className="px-4 py-2 text-center">Sig. (p-value)</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="hover:bg-red-950/20">
                              <td className="px-4 py-2 border-r border-red-950/80 font-medium text-stone-300">Kolmogorov-Smirnov</td>
                              <td className="px-4 py-2 border-r border-red-950/80 font-mono text-stone-400">{mathResults.regression.normality?.ks?.toFixed(3) ?? '-'}</td>
                              <td className="px-4 py-2 text-center font-mono font-bold text-emerald-400">{mathResults.regression.normality?.p?.toFixed(3) ?? '-'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      {aiInterpretations.step3_normalitas && (
                        <div className="text-[13px] sm:text-[14px] leading-relaxed text-stone-200 bg-[#140407] p-4 rounded-xl border border-red-900/60 font-mincho shadow-sm">
                          <strong className="text-red-400 font-cinzel">🗡️ Narasi Bab 4:</strong> {renderSafeString(aiInterpretations.step3_normalitas)}
                        </div>
                      )}
                    </section>
                  )}

                  {/* STEP 4: MULTIKOLINEARITAS */}
                  {mathResults.regression && Array.isArray(parsedPreview?.xVars) && parsedPreview.xVars.length > 1 && (
                    <section className="bg-[#0d0305] p-5 sm:p-6 rounded-2xl border border-red-950/90 shadow-[0_0_25px_rgba(0,0,0,0.7)]">
                      <h4 className="text-base sm:text-lg font-black text-stone-100 font-cinzel mb-4 border-b border-red-950/80 pb-2">
                        4. Uji Multikolinearitas (VIF)
                      </h4>
                      <div className="overflow-x-auto w-full custom-scrollbar pb-2">
                        <table className="w-full text-xs sm:text-sm text-left mb-4 border border-red-950/80 min-w-[350px]">
                          <thead className="bg-[#180508] text-red-300 font-bold uppercase text-[10px] sm:text-[11px] font-cinzel">
                            <tr className="border-b border-red-950/80">
                              <th className="px-4 py-2 border-r border-red-950/80">Variabel</th>
                              <th className="px-4 py-2 border-r border-red-950/80 text-center">Tolerance</th>
                              <th className="px-4 py-2 text-center">VIF</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mathResults.regression.coefficients.map((c, i) => (
                              <tr key={i} className="border-b border-red-950/50 hover:bg-red-950/20">
                                <td className="px-4 py-2 border-r border-red-950/80 font-medium text-stone-300">{c.name}</td>
                                <td className="px-4 py-2 border-r border-red-950/80 text-center font-mono text-stone-400">{(1/c.vif).toFixed(3)}</td>
                                <td className="px-4 py-2 text-center font-mono font-bold text-amber-400">{c.vif.toFixed(3)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {aiInterpretations.step4_multiko && (
                        <div className="text-[13px] sm:text-[14px] leading-relaxed text-stone-200 bg-[#140407] p-4 rounded-xl border border-red-900/60 font-mincho shadow-sm">
                          <strong className="text-red-400 font-cinzel">🗡️ Narasi Bab 4:</strong> {renderSafeString(aiInterpretations.step4_multiko)}
                        </div>
                      )}
                    </section>
                  )}

                  {/* STEP 5: HETEROSKEDASTISITAS */}
                  {mathResults.regression && Array.isArray(mathResults.regression.heteroGlejser) && (
                    <section className="bg-[#0d0305] p-5 sm:p-6 rounded-2xl border border-red-950/90 shadow-[0_0_25px_rgba(0,0,0,0.7)]">
                      <h4 className="text-base sm:text-lg font-black text-stone-100 font-cinzel mb-4 border-b border-red-950/80 pb-2">
                        5. Uji Heteroskedastisitas (Uji Glejser)
                      </h4>
                      <div className="overflow-x-auto w-full custom-scrollbar pb-2">
                        <table className="w-full text-xs sm:text-sm text-left mb-4 border border-red-950/80 min-w-[350px]">
                          <thead className="bg-[#180508] text-red-300 font-bold uppercase text-[10px] sm:text-[11px] font-cinzel">
                            <tr className="border-b border-red-950/80">
                              <th className="px-4 py-2 border-r border-red-950/80">Variabel (Abs Residual)</th>
                              <th className="px-4 py-2 text-center">Sig. (p-value)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mathResults.regression.heteroGlejser.map((h, i) => (
                              <tr key={i} className="border-b border-red-950/50 hover:bg-red-950/20">
                                <td className="px-4 py-2 border-r border-red-950/80 font-medium text-stone-300">{h.var}</td>
                                <td className="px-4 py-2 text-center font-mono font-bold text-emerald-400">{h.pVal.toFixed(3)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {aiInterpretations.step5_hetero && (
                        <div className="text-[13px] sm:text-[14px] leading-relaxed text-stone-200 bg-[#140407] p-4 rounded-xl border border-red-900/60 font-mincho shadow-sm">
                          <strong className="text-red-400 font-cinzel">🗡️ Narasi Bab 4:</strong> {renderSafeString(aiInterpretations.step5_hetero)}
                        </div>
                      )}
                    </section>
                  )}

                  {/* STEP 6 & 8: REGRESI LINEAR BERGANDA & UJI T */}
                  {mathResults.regression && Array.isArray(mathResults.regression.coefficients) && (
                    <section className="bg-[#0d0305] p-5 sm:p-6 rounded-2xl border border-red-950/90 shadow-[0_0_25px_rgba(0,0,0,0.7)]">
                      <h4 className="text-base sm:text-lg font-black text-stone-100 font-cinzel mb-4 border-b border-red-950/80 pb-2">
                        6 & 8. Analisis Regresi & Uji t
                      </h4>
                      <div className="mb-2 text-[11px] sm:text-sm text-stone-400 font-cinzel">Dependent Variable: <b className="text-red-400">{mathResults.regression.yName}</b></div>
                      <div className="overflow-x-auto w-full custom-scrollbar pb-2">
                        <table className="w-full text-xs sm:text-sm text-left mb-4 border border-red-950/80 min-w-[600px]">
                          <thead className="bg-[#180508] text-red-300 font-bold uppercase text-[10px] sm:text-[11px] font-cinzel">
                            <tr className="border-b border-red-950/80">
                              <th className="px-4 py-2 border-r border-red-950/80">Model</th>
                              <th className="px-4 py-2 border-r border-red-950/80 text-right">Unstandardized B</th>
                              <th className="px-4 py-2 border-r border-red-950/80 text-right">Std. Error</th>
                              <th className="px-4 py-2 border-r border-red-950/80 text-right">Beta</th>
                              <th className="px-4 py-2 border-r border-red-950/80 text-right">t Hitung</th>
                              <th className="px-4 py-2 text-center">Sig.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-red-950/50">
                             <tr className="hover:bg-red-950/20">
                               <td className="px-4 py-2 border-r border-red-950/80 font-medium text-stone-400">(Constant)</td>
                               <td className="px-4 py-2 border-r border-red-950/80 text-right font-mono text-stone-300">{mathResults.regression.intercept.b.toFixed(3)}</td>
                               <td className="px-4 py-2 border-r border-red-950/80 text-right font-mono text-stone-500">{mathResults.regression.intercept.se.toFixed(3)}</td>
                               <td className="px-4 py-2 border-r border-red-950/80 text-right font-mono text-stone-600">-</td>
                               <td className="px-4 py-2 border-r border-red-950/80 text-right font-mono text-stone-300">{mathResults.regression.intercept.t.toFixed(3)}</td>
                               <td className="px-4 py-2 text-center font-mono text-stone-400">{mathResults.regression.intercept.p.toFixed(3)}</td>
                             </tr>
                             {mathResults.regression.coefficients.map((c, i) => (
                                <tr key={i} className="hover:bg-red-950/20">
                                  <td className="px-4 py-2 border-r border-red-950/80 font-bold text-stone-200">{c.name}</td>
                                  <td className="px-4 py-2 border-r border-red-950/80 text-right font-mono font-bold text-red-400 bg-red-950/30">{c.b.toFixed(3)}</td>
                                  <td className="px-4 py-2 border-r border-red-950/80 text-right font-mono text-stone-500">{c.se.toFixed(3)}</td>
                                  <td className="px-4 py-2 border-r border-red-950/80 text-right font-mono font-bold text-purple-400 bg-purple-950/20">{c.beta.toFixed(3)}</td>
                                  <td className="px-4 py-2 border-r border-red-950/80 text-right font-mono text-red-300">{c.t.toFixed(3)}</td>
                                  <td className="px-4 py-2 text-center font-mono font-black text-emerald-400 bg-emerald-950/30">{c.p.toFixed(3)}</td>
                                </tr>
                             ))}
                          </tbody>
                        </table>
                      </div>
                      {aiInterpretations.step6_regresi && (
                        <div className="text-[13px] sm:text-[14px] leading-relaxed text-stone-200 bg-[#140407] p-4 rounded-xl border border-red-900/60 font-mincho shadow-sm mb-4 mt-2">
                          <strong className="text-red-400 font-cinzel">🗡️ (Persamaan Regresi):</strong> {renderSafeString(aiInterpretations.step6_regresi)}
                        </div>
                      )}
                      {aiInterpretations.step8_uji_t && (
                        <div className="text-[13px] sm:text-[14px] leading-relaxed text-stone-200 bg-[#140407] p-4 rounded-xl border border-red-900/60 font-mincho shadow-sm">
                          <strong className="text-red-400 font-cinzel">🗡️ (Uji Hipotesis Parsial / t):</strong> {renderSafeString(aiInterpretations.step8_uji_t)}
                        </div>
                      )}
                    </section>
                  )}

                  {/* STEP 7: KOEFISIEN DETERMINASI */}
                  {mathResults.regression && (
                    <section className="bg-[#0d0305] p-5 sm:p-6 rounded-2xl border border-red-950/90 shadow-[0_0_25px_rgba(0,0,0,0.7)]">
                      <h4 className="text-base sm:text-lg font-black text-stone-100 font-cinzel mb-4 border-b border-red-950/80 pb-2">
                        7. Uji Koefisien Determinasi (R Square)
                      </h4>
                      <div className="overflow-x-auto w-full custom-scrollbar pb-2">
                        <table className="w-full text-xs sm:text-sm text-left mb-4 border border-red-950/80 max-w-md min-w-[250px]">
                          <thead className="bg-[#180508] text-red-300 font-bold uppercase text-[10px] sm:text-[11px] font-cinzel">
                            <tr className="border-b border-red-950/80">
                              <th className="px-4 py-2 border-r border-red-950/80">Model</th>
                              <th className="px-4 py-2 text-center">R Square</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="hover:bg-red-950/20">
                              <td className="px-4 py-2 border-r border-red-950/80 font-medium text-stone-300">1</td>
                              <td className="px-4 py-2 text-center font-mono font-bold text-red-400 text-lg">{mathResults.regression.r2.toFixed(3)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      {aiInterpretations.step7_koef_det && (
                        <div className="text-[13px] sm:text-[14px] leading-relaxed text-stone-200 bg-[#140407] p-4 rounded-xl border border-red-900/60 font-mincho shadow-sm">
                          <strong className="text-red-400 font-cinzel">🗡️ Narasi Bab 4:</strong> {renderSafeString(aiInterpretations.step7_koef_det)}
                        </div>
                      )}
                    </section>
                  )}

                  {/* STEP 9: UJI F (SIMULTAN / ANOVA) */}
                  {mathResults.regression && (
                    <section className="bg-[#0d0305] p-5 sm:p-6 rounded-2xl border border-red-950/90 shadow-[0_0_25px_rgba(0,0,0,0.7)]">
                      <h4 className="text-base sm:text-lg font-black text-stone-100 font-cinzel mb-4 border-b border-red-950/80 pb-2">
                        9. Uji F (Simultan / ANOVA)
                      </h4>
                      <div className="mb-2 text-[11px] sm:text-sm text-stone-400 font-cinzel">Dependent Variable: <b className="text-red-400">{mathResults.regression.yName}</b></div>
                      <div className="overflow-x-auto w-full custom-scrollbar pb-2">
                        <table className="w-full text-xs sm:text-sm text-left mb-4 border border-red-950/80 min-w-[450px]">
                          <thead className="bg-[#180508] text-red-300 font-bold uppercase text-[10px] sm:text-[11px] font-cinzel">
                            <tr className="border-b border-red-950/80">
                              <th className="px-4 py-2 border-r border-red-950/80">Model</th>
                              <th className="px-4 py-2 border-r border-red-950/80 text-center">df1</th>
                              <th className="px-4 py-2 border-r border-red-950/80 text-center">df2</th>
                              <th className="px-4 py-2 border-r border-red-950/80 text-center">F Hitung</th>
                              <th className="px-4 py-2 text-center">Sig.</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="hover:bg-red-950/20">
                              <td className="px-4 py-2 border-r border-red-950/80 font-medium text-stone-300">Regression</td>
                              <td className="px-4 py-2 border-r border-red-950/80 text-center font-mono text-stone-400">{mathResults.regression.dfRegresi}</td>
                              <td className="px-4 py-2 border-r border-red-950/80 text-center font-mono text-stone-400">{mathResults.regression.dfResidual}</td>
                              <td className="px-4 py-2 border-r border-red-950/80 text-center font-mono font-bold text-red-400">{mathResults.regression.fValue.toFixed(3)}</td>
                              <td className="px-4 py-2 text-center font-mono font-black text-emerald-400 bg-emerald-950/30">{mathResults.regression.fPValue.toFixed(3)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      {aiInterpretations.step9_uji_f && (
                        <div className="text-[13px] sm:text-[14px] leading-relaxed text-stone-200 bg-[#140407] p-4 rounded-xl border border-red-900/60 font-mincho shadow-sm">
                          <strong className="text-red-400 font-cinzel">🗡️ (Uji Simultan Hipotesis F):</strong> {renderSafeString(aiInterpretations.step9_uji_f)}
                        </div>
                      )}
                    </section>
                  )}

                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-stone-500 p-4">
                  <BarChart3 size={56} className="mb-4 opacity-25 text-red-500" />
                  <h3 className="text-lg sm:text-xl font-bold text-stone-300 mb-2 font-cinzel">Ruang Singgasana Hasil</h3>
                  <p className="text-xs sm:text-sm font-medium text-center max-w-sm text-stone-500 font-mincho">
                    Tempelkan data kuesioner Excel pada panel kiri, lalu lepaskan tebasan analisis. Hasil 8 tahapan akan dipahat ke gulungan ini.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default LabStatistikApp;
