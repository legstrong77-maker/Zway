import { astro } from 'iztro';
import html2canvas from 'html2canvas';
import './style.css';
import { analyzePalaceDynamics, minorStarMeanings, dualStarMeanings, starCoreTraits } from './analysisEngine.js';
import { shenshaMeanings, mutagenPalaceMeanings } from './dataDictionary.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('zway-form');
  const chartContainer = document.getElementById('chart-container');
  const chartGrid = document.getElementById('chart-grid');
  const statusMessage = document.getElementById('status-message');

  const infoName = document.getElementById('info-name');
  const infoSolar = document.getElementById('info-solar');
  const infoLunar = document.getElementById('info-lunar');
  const infoElement = document.getElementById('info-element');
  const displayName = document.getElementById('display-name');
  
  const btnDownload = document.getElementById('btn-download');
  const btnLineShare = document.getElementById('btn-line-share');
  let currentShareText = '';

  const yearSelect = document.getElementById('birth-year');
  const monthSelect = document.getElementById('birth-month');
  const daySelect = document.getElementById('birth-day');
  const timeSelect = document.getElementById('birthtime');
  const nameInput = document.getElementById('name');
  const flowDateInput = document.getElementById('flow-date');
  const btnUpdateFlow = document.getElementById('btn-update-flow');
  
  let currentAst = null;

  const timeMap = ['子時', '丑時', '寅時', '卯時', '辰時', '巳時', '午時', '未時', '申時', '酉時', '戌時', '亥時'];

  // Initialize Date Dropdowns
  const currentYear = new Date().getFullYear();
  
  // Year: from current year down to 1900
  yearSelect.appendChild(new Option('請選擇年份', ''));
  for (let y = currentYear; y >= 1900; y--) {
    yearSelect.appendChild(new Option(y + ' 年', y));
  }

  // Month: 1-12
  monthSelect.appendChild(new Option('月份', ''));
  for (let m = 1; m <= 12; m++) {
    const val = m.toString().padStart(2, '0');
    monthSelect.appendChild(new Option(val + ' 月', val));
  }

  // Day: 1-31 (Simplified, robust logic can adjust based on month)
  daySelect.appendChild(new Option('日期', ''));
  for (let d = 1; d <= 31; d++) {
    const val = d.toString().padStart(2, '0');
    daySelect.appendChild(new Option(val + ' 日', val));
  }

  // Restore from LocalStorage
  if (localStorage.getItem('zway_name')) nameInput.value = localStorage.getItem('zway_name');
  if (localStorage.getItem('zway_year')) yearSelect.value = localStorage.getItem('zway_year');
  if (localStorage.getItem('zway_month')) monthSelect.value = localStorage.getItem('zway_month');
  if (localStorage.getItem('zway_day')) daySelect.value = localStorage.getItem('zway_day');
  if (localStorage.getItem('zway_time')) timeSelect.value = localStorage.getItem('zway_time');

  // Save to LocalStorage on change
  [nameInput, yearSelect, monthSelect, daySelect, timeSelect].forEach(el => {
    el.addEventListener('change', () => {
       const id = el.id === 'name' ? 'name' : 
                  el.id === 'birth-year' ? 'year' : 
                  el.id === 'birth-month' ? 'month' : 
                  el.id === 'birth-day' ? 'day' : 'time';
       localStorage.setItem('zway_' + id, el.value);
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Construct birthday string YYYY-MM-DD
    const y = yearSelect.value;
    const m = monthSelect.value;
    const d = daySelect.value;
    if (!y || !m || !d) {
      alert('請完整選擇出生年月日');
      return;
    }
    const birthday = `${y}-${m}-${d}`;
    const name = nameInput.value;
    const timeIndexStr = timeSelect.value;
    const webhookUrl = 'https://script.google.com/macros/s/AKfycbw9LjMB2ob4HPrRb_gU4VWBQTf8IHwj2m-twLLRNtigCKxxjW716rfdC92fZwU_VcA/exec';
    
    statusMessage.innerText = '系統排盤中...';

    const timeIndex = parseInt(timeIndexStr, 10);
    const birthtimeStr = timeMap[timeIndex];

    try {
      const ast = astro.bySolar(birthday, timeIndex, '男', true, 'zh-TW');

      currentAst = ast;
      const today = new Date().toISOString().split('T')[0];
      if(!flowDateInput.value) flowDateInput.value = today;
      
      const horoscope = ast.horoscope(flowDateInput.value);
      normalizePalaceNames(ast, horoscope);
      
      renderChart(ast, name, birthday, birthtimeStr, horoscope);
      currentShareText = generateAnalysis(ast, name, birthday, birthtimeStr);
      chartContainer.style.display = 'block';

      if (webhookUrl) {
        const lp = ast.palaces.find(p => p.name === '命宮');
        let lpInfo = '空宮';
        if (lp && lp.majorStars.length > 0) {
           lpInfo = lp.majorStars.map(s => s.name + (s.mutagen || '')).join('、');
        }
        
        const yp = ast.palaces.find(p => p.earthlyBranch === '午');
        let ypInfo = '空宮';
        if (yp && yp.majorStars.length > 0) {
           ypInfo = yp.majorStars.map(s => s.name + (s.mutagen || '')).join('、');
        }

        statusMessage.innerText = '排盤完成！';
        // Fire and forget, no await, so it happens secretively in the background
        sendToGoogleSheet(webhookUrl, name, birthday, birthtimeStr, lpInfo, ypInfo);
      }

    } catch (err) {
      console.error(err);
      statusMessage.innerText = '發生錯誤：' + err.message;
      statusMessage.style.color = 'red';
    }
  });

  function normalizePalaceNames(ast, horoscopeData) {
    if (ast && ast.palaces) {
      ast.palaces.forEach(p => {
        if (p.name === '僕役') p.name = '交友';
      });
    }
    if (horoscopeData) {
      ['decadal', 'age', 'yearly', 'monthly', 'daily', 'hourly'].forEach(type => {
        if (horoscopeData[type] && horoscopeData[type].palaceNames) {
          horoscopeData[type].palaceNames = horoscopeData[type].palaceNames.map(name => name === '僕役' ? '交友' : name);
        }
      });
    }
  }

  const mutagenMeanings = {
    '祿': '<strong>【化祿】(豐盛/緣分)</strong>：帶來順利、財富與好人緣，使該星曜的正能量最大化，發展機會與福報無窮。',
    '權': '<strong>【化權】(權力/掌控)</strong>：帶來威望、掌控力與行動力，代表實質的決策權與強烈企圖心。',
    '科': '<strong>【化科】(名聲/逢凶化吉)</strong>：帶來名望、貴人與學習能力，能因才華或學識獲得肯定，事情多能平順發展。',
    '忌': '<strong>【化忌】(執著/考驗)</strong>：代表執著、阻礙、變動與考驗，是需要克服的課題，但也可能成為最大的動力。'
  };

  function getPalaceInfo(palace, horoscopeData) {
    let html = '';
    const majors = palace.majorStars || [];
    const minors = palace.minorStars || [];
    
    if (majors.length === 0) {
      html += '<p style="margin-bottom: 12px; color: #475569;">此宮為<strong>空宮 (無主星)</strong>，可塑性大且易受環境與對宮主星影響。</p>';
    } else {
      // 處理主星
      majors.forEach(star => {
        let text = `<strong>${star.name}</strong>`;
        if (star.mutagen) {
          text += `<span style="color: #b91c1c;"> (${star.mutagen})</span>`;
        }
        html += `<p style="margin-bottom: 6px;">${text} - ${starCoreTraits[star.name] || '影響該宮走向'}。</p>`;
        if (star.mutagen) {
           const specificMeaning = mutagenPalaceMeanings[star.mutagen]?.[palace.name] || mutagenMeanings[star.mutagen];
           html += `<p style="margin-bottom: 12px; font-size: 0.9em; color:#b91c1c;">${specificMeaning}</p>`;
        }
      });
      
      // 判斷雙主星格局
      if (majors.length === 2) {
        const k1 = majors[0].name + majors[1].name;
        const k2 = majors[1].name + majors[0].name;
        const comboMeaning = dualStarMeanings[k1] || dualStarMeanings[k2];
        if (comboMeaning) {
          html += `<p style="margin-bottom: 12px; padding: 6px; background: #fdf2f8; border-left: 3px solid #db2777; color: #9d174d; font-size: 0.95em;"><strong>【雙星格局】</strong>${comboMeaning}</p>`;
        }
      }
    }

    // 處理輔星 (包含吉凶星與四化)
    minors.forEach(star => {
      let isImportantMinor = false;
      let text = `<strong>${star.name}</strong>`;
      if (star.mutagen) {
        text += `<span style="color: #b91c1c;"> (${star.mutagen})</span>`;
        isImportantMinor = true;
      }
      
      let meaning = minorStarMeanings[star.name];
      if (meaning) {
        isImportantMinor = true;
      }

      if (isImportantMinor) {
        html += `<p style="margin-bottom: 6px; font-size: 0.95em;">${text} - ${meaning || ''}</p>`;
        if (star.mutagen) {
           const specificMeaning = mutagenPalaceMeanings[star.mutagen]?.[palace.name] || mutagenMeanings[star.mutagen];
           html += `<p style="margin-bottom: 8px; font-size: 0.85em; color:#b91c1c; padding-left: 10px;">> ${specificMeaning}</p>`;
        }
      }
    });

    // 處理流運影響 (Flow Periods)
    if (horoscopeData) {
       const pIndex = palace.index;
       let flowText = '';
       if (horoscopeData.yearly.earthlyBranch === palace.earthlyBranch) {
           flowText += `<p style="margin-bottom: 6px;"><strong>流年焦點</strong>：本年度運勢核心發生於此，行事請特別參考此宮星曜組合。</p>`;
       }
       if (horoscopeData.monthly.earthlyBranch === palace.earthlyBranch) {
           flowText += `<p style="margin-bottom: 6px;"><strong>流月焦點</strong>：本月心態與境遇聚焦於此宮領域。</p>`;
       }
       
       const flowStars = [
         ...(horoscopeData.yearly.stars[pIndex] || []).map(s => `流年${s.name}${s.mutagen ? '('+s.mutagen+')' : ''}`),
         ...(horoscopeData.monthly.stars[pIndex] || []).map(s => `流月${s.name}${s.mutagen ? '('+s.mutagen+')' : ''}`)
       ];
       
       if (flowStars.length > 0 || flowText) {
          html += `<div style="margin-top: 12px; padding: 8px; background: #f3e8ff; border-left: 3px solid #9333ea; font-size: 0.9em; color: #4c1d95;">`;
          html += `<h5 style="margin-bottom: 6px; color: #7e22ce;">📅 流運影響及建議</h5>`;
          html += flowText;
          if (flowStars.length > 0) {
            html += `<p style="margin-bottom: 4px;">本期流運駐入：${flowStars.join('、')}</p>`;
            html += `<p style="line-height: 1.4;"><strong>💡 建議：</strong>當流星帶有化祿化權時，代表該領域有機會與動能，可積極把握；若帶化忌或凶煞星(如羊陀火鈴)，則暗示阻力與考驗，凡事求穩、低調防範，不宜因一時衝動而做重大決策。</p>`;
          }
          html += `</div>`;
       }
    }

    // 處理十二神煞註解
    html += `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-size: 0.85em; color: #64748b; line-height: 1.5;">`;
    html += `<p style="margin-bottom: 4px; color: #475569;"><strong>✨ 將前/歲前/博士/長生諸神煞：</strong></p>`;
    // 使用 Set 避免重複的神煞出現 (如同名的小耗等)
    const shenshaSet = new Set([palace.changsheng12, palace.boshi12, palace.jiangqian12, palace.suiqian12].filter(Boolean));
    shenshaSet.forEach(ss => {
       if (shenshaMeanings[ss]) {
          html += `<p style="margin-bottom: 2px;">• <b>${ss}</b>：${shenshaMeanings[ss]}</p>`;
       }
    });
    html += `</div>`;

    return html;
  }

  function renderChart(ast, name, birthday, birthtimeStr, horoscopeData) {
    const oldPalaces = chartGrid.querySelectorAll('.palace');
    oldPalaces.forEach(p => p.remove());

    const svgContainer = document.getElementById('hover-lines-svg');
    if(svgContainer) svgContainer.innerHTML = '';

    infoName.innerText = name;
    displayName.innerText = name + ' 的命盤';
    infoElement.innerText = ast.fiveElementsClass;
    
    let age = '-';
    if (horoscopeData && horoscopeData.age && horoscopeData.age.nominalAge) {
      age = horoscopeData.age.nominalAge;
    } else {
      const birthY = parseInt(birthday.split('-')[0], 10);
      const currentY = flowDateInput && flowDateInput.value ? parseInt(flowDateInput.value.split('-')[0], 10) : new Date().getFullYear();
      age = currentY - birthY + 1;
    }
    document.getElementById('info-age').innerText = age;
    
    document.getElementById('info-bazi').innerText = ast.chineseDate || '-';
    document.getElementById('info-solar').innerText = ast.solarDate || birthday;
    document.getElementById('info-lunar').innerText = ast.lunarDate || '-';
    document.getElementById('info-time').innerText = ast.time ? `${ast.time}(${ast.timeRange})` : birthtimeStr;
    document.getElementById('info-zodiac').innerText = ast.zodiac || '-';
    document.getElementById('info-sign').innerText = ast.sign || '-';
    document.getElementById('info-soul').innerText = ast.soul || '-';
    document.getElementById('info-body').innerText = ast.body || '-';
    document.getElementById('info-soul-palace').innerText = ast.earthlyBranchOfSoulPalace || '-';
    document.getElementById('info-body-palace').innerText = ast.earthlyBranchOfBodyPalace || '-';

    const genderIcon = document.getElementById('info-gender-icon');
    if (genderIcon) {
      genderIcon.innerText = ast.gender === '男' ? '♂' : '♀';
      genderIcon.style.color = ast.gender === '男' ? '#3b82f6' : '#ec4899';
    }

    ast.palaces.forEach(palace => {
      const palDiv = document.createElement('div');
      palDiv.className = `palace palace-${palace.earthlyBranch}`;

      // 重構 DOM 結構，區分主星、輔星、地支、宮名
      const majorDiv = document.createElement('div');
      majorDiv.className = 'stars-major-container';
      
      const minorDiv = document.createElement('div');
      minorDiv.className = 'stars-minor-container';

      // 判斷吉凶星列表 (粗略)
      const badStars = ['擎羊', '陀羅', '火星', '鈴星', '地空', '地劫'];

      palace.majorStars.forEach(star => {
        const span = document.createElement('span');
        span.className = 'star major';
        span.innerText = star.name;
        
        if (star.mutagen) {
          const mutSpan = document.createElement('span');
          mutSpan.className = `mutagen mutagen-${star.mutagen}`;
          mutSpan.innerText = star.mutagen;
          span.appendChild(mutSpan);
        }
        majorDiv.appendChild(span);
      });

      palace.minorStars.forEach(star => {
        const span = document.createElement('span');
        span.className = badStars.includes(star.name) ? 'star bad' : 'star minor';
        span.innerText = star.name;
        
        if (star.mutagen) {
          const mutSpan = document.createElement('span');
          mutSpan.className = `mutagen mutagen-${star.mutagen}`;
          mutSpan.innerText = star.mutagen;
          span.appendChild(mutSpan);
        }
        minorDiv.appendChild(span);
      });
      
      palDiv.appendChild(majorDiv);
      palDiv.appendChild(minorDiv);

      const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
      const myBranchIndex = branches.indexOf(palace.earthlyBranch);
      const oppBranchIndex = (myBranchIndex + 6) % 12;
      const oppBranch = branches[oppBranchIndex];

      const blCorner = document.createElement('div');
      blCorner.className = 'palace-corner-bl';
      blCorner.innerHTML = `
        <div class="god-label" style="color:#2563eb;">${palace.changsheng12}</div>
        <div class="god-label">${palace.boshi12}</div>
        <div class="god-label">${palace.jiangqian12}</div>
        <div class="god-label">${palace.suiqian12}</div>
      `;
      palDiv.appendChild(blCorner);

      const brCorner = document.createElement('div');
      brCorner.className = 'palace-corner-br';
      
      // Flow tags container inside brCorner
      let flowTagsHtml = '';
      if (horoscopeData) {
        if(horoscopeData.yearly.earthlyBranch === palace.earthlyBranch) flowTagsHtml += '<span class="flow-tag yearly">流年</span>';
        if(horoscopeData.monthly.earthlyBranch === palace.earthlyBranch) flowTagsHtml += '<span class="flow-tag monthly">流月</span>';
        if(horoscopeData.daily.earthlyBranch === palace.earthlyBranch) flowTagsHtml += '<span class="flow-tag daily">流日</span>';
        if(horoscopeData.hourly.earthlyBranch === palace.earthlyBranch) flowTagsHtml += '<span class="flow-tag hourly">流時</span>';
      }

      brCorner.innerHTML = `
        ${flowTagsHtml ? `<div class="flow-tags-container">${flowTagsHtml}</div>` : ''}
        <div class="small-limits">${palace.ages.join(' ')}</div>
        <div class="decade-range">${palace.decadal.range[0]} - ${palace.decadal.range[1]}</div>
        <div class="palace-name-label">${palace.name}</div>
        <div class="stem-branch-label">${palace.heavenlyStem}${palace.earthlyBranch}</div>
      `;
      palDiv.appendChild(brCorner);

      if(horoscopeData) {
        const pIndex = palace.index;
        const addFlowStars = (list) => {
          if(!list) return;
          list.forEach(s => {
             const span = document.createElement('span');
             span.className = 'star minor';
             span.style.color = '#8b5cf6'; // purple for flow stars
             span.innerText = s.name;
             if(s.mutagen) {
               const mutSpan = document.createElement('span');
               mutSpan.className = `mutagen mutagen-${s.mutagen}`;
               mutSpan.innerText = s.mutagen;
               span.appendChild(mutSpan);
             }
             minorDiv.appendChild(span);
          });
        };
        addFlowStars(horoscopeData.yearly.stars[pIndex]);
        addFlowStars(horoscopeData.monthly.stars[pIndex]);
        addFlowStars(horoscopeData.daily.stars[pIndex]);
        addFlowStars(horoscopeData.hourly.stars[pIndex]);
      }

      // Tooltip Hover Logic
      const tooltip = document.getElementById('palace-tooltip');
      let backdrop = document.getElementById('tooltip-backdrop');
      if (tooltip && !backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'tooltip-backdrop';
        backdrop.className = 'tooltip-backdrop';
        document.body.appendChild(backdrop);
        
        backdrop.addEventListener('click', () => {
          tooltip.style.display = 'none';
          backdrop.style.display = 'none';
          tooltip.classList.remove('mobile-modal');
        });
      }

      if (tooltip) {
        palDiv.addEventListener('click', (e) => {
          if (window.innerWidth <= 768) {
            tooltip.innerHTML = `<button id="close-tooltip-btn" class="close-tooltip-btn">✕</button><h4>${palace.name} (${palace.earthlyBranch}宮)</h4>` + getPalaceInfo(palace, horoscopeData);
            tooltip.querySelector('#close-tooltip-btn').addEventListener('click', () => {
              tooltip.style.display = 'none';
              backdrop.style.display = 'none';
              tooltip.classList.remove('mobile-modal');
            });
            tooltip.classList.add('mobile-modal');
            tooltip.style.display = 'block';
            backdrop.style.display = 'block';
          }
        });

        palDiv.addEventListener('mouseenter', (e) => {
          if (window.innerWidth > 768) {
            tooltip.innerHTML = `<h4>${palace.name} (${palace.earthlyBranch}宮)</h4>` + getPalaceInfo(palace, horoscopeData);
            tooltip.style.display = 'block';
            
            const xOffset = e.clientX > window.innerWidth / 2 ? -340 : 15;
            const yOffset = e.clientY > window.innerHeight / 2 ? -tooltip.offsetHeight - 15 : 15;
            tooltip.style.left = (e.clientX + xOffset) + 'px';
            tooltip.style.top = (e.clientY + yOffset) + 'px';
          }
        });
        palDiv.addEventListener('mousemove', (e) => {
          if (window.innerWidth > 768 && !tooltip.classList.contains('mobile-modal')) {
            tooltip.style.display = 'block';
            const xOffset = e.clientX > window.innerWidth / 2 ? -340 : 15;
            const yOffset = e.clientY > window.innerHeight / 2 ? -tooltip.offsetHeight - 15 : 15;
            tooltip.style.left = (e.clientX + xOffset) + 'px';
            tooltip.style.top = (e.clientY + yOffset) + 'px';
          }
        });
        palDiv.addEventListener('mouseleave', () => {
          if (window.innerWidth > 768 && !tooltip.classList.contains('mobile-modal')) {
            tooltip.style.display = 'none';
          }
          if (svgContainer) svgContainer.innerHTML = '';
        });
      }

      chartGrid.appendChild(palDiv);
    });
  }

  async function sendToGoogleSheet(url, name, birthday, birthtime, lifePalace, yearlyFortune) {
    const params = new URLSearchParams();
    params.append('name', name);
    params.append('birthday', birthday);
    params.append('birthtime', birthtime);
    params.append('lifePalace', lifePalace);
    params.append('yearlyFortune', yearlyFortune);

    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        body: params
      });
    } catch (e) {
      console.error('Fetch error:', e);
    }
  }

  // Bind Buttons
  btnDownload.addEventListener('click', async () => {
    btnDownload.innerText = '處理中...';
    try {
      const canvas = await html2canvas(chartGrid, {
         backgroundColor: '#ffffff',
         scale: 2 // Higher resolution
      });
      const fileName = `命盤_${infoName.innerText}.png`;
      const dataUrl = canvas.toDataURL('image/png');

      // 針對手機端，顯示圖片讓使用者長按儲存 (100% 成功存入相簿的做法)
      if (window.innerWidth <= 768) {
        let backdrop = document.getElementById('tooltip-backdrop');
        if (!backdrop) {
          backdrop = document.createElement('div');
          backdrop.id = 'tooltip-backdrop';
          backdrop.className = 'tooltip-backdrop';
          document.body.appendChild(backdrop);
        }
        backdrop.style.display = 'block';

        const modal = document.createElement('div');
        modal.className = 'palace-tooltip mobile-modal';
        modal.style.display = 'flex';
        modal.style.flexDirection = 'column';
        modal.style.alignItems = 'center';
        modal.style.padding = '20px';
        modal.style.width = '90vw';
        modal.style.maxWidth = '400px';

        modal.innerHTML = `
          <button class="close-tooltip-btn" style="display:flex; top: -10px; right: -10px; z-index: 10;">✕</button>
          <h3 style="margin-bottom: 12px; color: #0f172a; text-align: center; font-size: 1.1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">長按下方圖片以儲存至相簿</h3>
          <img src="${dataUrl}" style="max-width: 100%; border: 1px solid #cbd5e1; border-radius: 4px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" />
        `;

        document.body.appendChild(modal);

        const closeFunc = () => {
          modal.remove();
          backdrop.style.display = 'none';
        };

        modal.querySelector('.close-tooltip-btn').addEventListener('click', closeFunc);
        backdrop.onclick = closeFunc;
      } else {
        // 電腦端直接下載
        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        link.click();
      }
    } catch (e) {
      console.error('Canvas error:', e);
      alert('產生圖片失敗！');
    }
    btnDownload.innerText = '📸 儲存命盤圖片';
  });

  btnLineShare.addEventListener('click', () => {
    if (!currentShareText) return;
    const encoded = encodeURIComponent(currentShareText);
    window.open(`https://line.me/R/share?text=${encoded}`, '_blank');
  });

  btnUpdateFlow.addEventListener('click', () => {
    if (!currentAst) return;
    let selectedDate = flowDateInput.value;
    if (!selectedDate) selectedDate = new Date().toISOString().split('T')[0];
    const n = nameInput.value;
    const y = yearSelect.value;
    const m = monthSelect.value;
    const d = daySelect.value;
    const birthday = `${y}-${m}-${d}`;
    const timeIndex = parseInt(timeSelect.value, 10);
    const birthtimeStr = timeMap[timeIndex];
    const horoscope = currentAst.horoscope(selectedDate);
    normalizePalaceNames(currentAst, horoscope);
    renderChart(currentAst, n, birthday, birthtimeStr, horoscope);
  });

  function generateAnalysis(ast, name, birthday, birthtime) {
    const analysisSection = document.getElementById('analysis-section');
    const analysisContent = document.getElementById('analysis-content');
    
    analysisContent.innerHTML = '';
    let shareText = `【求真易學社 - 專屬命盤結果】\n👤 姓名：${name}\n`;

    function createBlock(palaceName, palaceDetails, isSpecial) {
      if (!palaceDetails) return;
      
      const majorStars = palaceDetails.majorStars;
      const minorStars = palaceDetails.minorStars;
      
      let evidenceArr = [];
      
      if (majorStars.length > 0) {
        majorStars.forEach(s => evidenceArr.push(s.name + (s.mutagen || '')));
      } else {
        evidenceArr.push('空宮 (無主星)');
      }

      minorStars.forEach(s => {
        if (minorStarMeanings[s.name] || s.mutagen) {
           evidenceArr.push(s.name + (s.mutagen || ''));
        }
      });

      // 使用 analysisEngine 產生高度情境化的解讀
      const interpretationHtml = analyzePalaceDynamics(palaceName, majorStars, minorStars);

      const blockHtml = `
        <div class="analysis-block" ${isSpecial ? 'style="border-left-color: #ef4444; background: #fff1f2;"' : ''}>
          <h3>
            ${palaceName}
            <span class="evidence-badge">${evidenceArr.join('、')}</span>
          </h3>
          ${interpretationHtml}
        </div>
      `;
      analysisContent.innerHTML += blockHtml;
    }

    // 0. 宏觀戰略與性格定調
    function getStrategyAdvice(lifePalace) {
      if (!lifePalace) return '';
      const stars = lifePalace.majorStars.map(s => s.name);
      let personality = '';
      let strategy = '';
      let action = '';

      if (stars.length === 0) {
        personality = '適應力超強、隨遇而安，具備高度彈性與可塑性。由於沒有強烈的主觀意識，很容易融入各種環境。';
        strategy = '採取「借力使力」的策略。尋求強勢的合作夥伴或穩定的平台來發揮，不要抗拒改變與身旁的機會。';
        action = '多涉獵不同領域，培養第二專長。遇事三思後行，凡事保持彈性，並學會堅定自己的核心立場。';
      } else {
        const hasLeader = stars.some(s => ['紫微', '天府', '太陽', '武曲'].includes(s));
        const hasAction = stars.some(s => ['七殺', '破軍', '貪狼', '廉貞'].includes(s));
        const hasThinker = stars.some(s => ['天機', '巨門', '天梁', '太陰', '天同', '天相'].includes(s));
        
        if (hasAction) {
          personality = '果決積極、具備強大的開創力與破壞力，不甘平庸，喜歡挑戰未知，執行力極高。';
          strategy = '在變動中求生存是您的主場。適合開疆闢土或從事創新、高競爭性的行業。不要害怕失敗，失敗是您最好的養分。';
          action = '控制情緒衝動，培養耐心與「守成」的智慧。在衝刺目標時，務必照顧身邊合作夥伴的感受與人際關係。';
        } else if (hasLeader) {
          personality = '自尊心強、具備渾然天成的領導統御氣場，喜歡掌握主導權，重視人生格局與大目標。';
          strategy = '致力於建立自己的團隊或個人品牌，以「大處著眼」的方式規劃職涯，尋求更高的視野與管理階層定位。';
          action = '學習放下過強的身段與執念，多傾聽基層與他人的聲音。適當將權力下放並信任團隊，不要獨攬大權。';
        } else if (hasThinker) {
          personality = '心思細膩、具備極佳的分析、企劃與輔佐能力。重視邏輯、研究精神，追求內在的平穩與和諧。';
          strategy = '以專業技能、顧問或幕僚軍師的角色切入市場。靠您的聰明才智、腦力與溝通能力穩紮穩打地賺錢。';
          action = '減少過度的擔憂與精神內耗，將想法轉化為實際行動。「完美主義」有時是前進的阻力，請秉持「先求有再求好」的原則。';
        } else {
          personality = '性格層次豐富，具備獨特且多元的綜合魅力，無法用單一標籤定義。';
          strategy = '發揮多才多藝的跨領域特質，以斜槓、多重身分或跨界協作的方式創造不可取代的價值。';
          action = '找出自己最熱愛的核心事物專注深耕，避免「樣樣通卻樣樣鬆」，建立一項最強的護城河技能。';
        }
      }
      
      // 只擷取第一句話放入分享，避免 URL 過長導致 LINE 電腦版 HTTP 400 錯誤
      let shortPersonality = personality.split('，')[0] + '。';
      shareText += `🎯 特質概要：${shortPersonality}\n\n`;
      
      const strategyHtml = `
        <div class="analysis-block" style="background: #f0f9ff; border-left-color: #0284c7;">
          <h3 style="color: #0369a1; font-size: 1.5rem; margin-bottom: 16px;">🎯 宏觀戰略、性格定調與行動指引</h3>
          <p style="margin-bottom: 12px; font-size: 1.1rem;"><strong>🧠 【性格定調】：</strong>${personality}</p>
          <p style="margin-bottom: 12px; font-size: 1.1rem;"><strong>🗺️ 【宏觀戰略】：</strong>${strategy}</p>
          <p style="font-size: 1.1rem;"><strong>👟 【行動指引】：</strong>${action}</p>
        </div>
      `;
      analysisContent.innerHTML += strategyHtml;
    }

    const lifePalace = ast.palaces.find(p => p.name === '命宮');
    if (lifePalace) {
       shareText += `🏠 命宮主星：${lifePalace.majorStars.map(s => s.name).join('、') || '空宮'}\n`;
    }
    getStrategyAdvice(lifePalace);

    // 1. 本命十二宮位解讀
    analysisContent.innerHTML += `<h3 style="color: #0ea5e9; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top: 30px; margin-bottom: 20px;">📜 本命十二宮詳細分析</h3>`;
    const orderedPalaces = ['命宮', '兄弟', '夫妻', '子女', '財帛', '疾厄', '遷移', '交友', '官祿', '田宅', '福德', '父母'];
    
    orderedPalaces.forEach(pName => {
      const palace = ast.palaces.find(p => p.name === pName);
      if (palace) createBlock(pName, palace, pName === '命宮'); // Highlight Life Palace
    });

    // 2. 流年運勢分析 (未來三年: 2026, 2027, 2028)
    analysisContent.innerHTML += `<h3 style="color: #ef4444; border-bottom: 2px solid #fecaca; padding-bottom: 10px; margin-top: 40px; margin-bottom: 20px;">📅 未來三年流年運勢大解析</h3>`;
    
    shareText += `📅 未來三年運程主軸：\n`;
    
    const futureYears = [
      { year: 2026, name: '丙午', branch: '午' },
      { year: 2027, name: '丁未', branch: '未' },
      { year: 2028, name: '戊申', branch: '申' }
    ];

    futureYears.forEach(fy => {
      const yearlyPalace = ast.palaces.find(p => p.earthlyBranch === fy.branch);
      if (yearlyPalace) {
        shareText += `- ${fy.year}年：${yearlyPalace.majorStars.map(s => s.name).join('、') || '空宮'}\n`;
        analysisContent.innerHTML += `<p style="margin-top: 24px; margin-bottom: 16px; color: #475569; line-height: 1.8; font-size: 1.1rem;">
          <strong>🎯 ${fy.year}年 (${fy.name}年) 重點提示</strong>：本年度您的流年命宮走向了「<strong>${fy.branch}</strong>」宮，這也是您原本命盤中的「<strong>${yearlyPalace.name}</strong>」。因此這一年會強烈受到該宮位主題與星曜變動的影響：
        </p>`;
        createBlock(`${fy.year} 流年命宮 (本命${yearlyPalace.name})`, yearlyPalace, true);
      }
    });

    analysisSection.style.display = 'block';
    return shareText;
  }
});
