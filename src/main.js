import { astro } from 'iztro';
import html2canvas from 'html2canvas';
import './style.css';

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

      renderChart(ast, name, birthday, birthtimeStr);
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

  const starMeanings = {
    '紫微': '【紫微星】代表尊貴與領導力，具備帝王之氣，個性穩重且有強烈的自尊心與企圖心，是開創事業的將帥之才。',
    '天機': '【天機星】是智慧與變動的象徵，代表反應靈敏、善於籌謀、喜歡動腦，適應力強，但有時容易思慮過多而猶豫。',
    '太陽': '【太陽星】代表熱情、博愛、光明磊落，具有無私奉獻的特質，喜歡照顧他人，重視名譽勝於財富，執行力極強。',
    '武曲': '【武曲星】為將星與財星，代表剛毅果決、行動力強、重視實際收益，個性較為直率耿直，吃苦耐勞。',
    '天同': '【天同星】為福星，代表溫和、善良、隨遇而安，重視生活情趣與人際和諧，有時稍微缺乏開創的強烈動力，適合平穩發展。',
    '廉貞': '【廉貞星】代表次桃花與囚星，個性多變、靈活、帶有傲氣，公私分明，對工作有高度的熱忱與責任感。',
    '天府': '【天府星】是南斗主星，代表財庫與包容力，個性穩重慈悲，有領導統御的能力，善於守成與理財。',
    '太陰': '【太陰星】代表母性與財富，個性溫柔細膩、重視家庭與感情，具有藝術天賦與直覺力，財富多為累積而來。',
    '貪狼': '【貪狼星】是第一大桃花星，代表慾望、多才多藝、交際手腕靈活，善於把握機會，但也容易因為慾望而多變。',
    '巨門': '【巨門星】被稱為暗星，代表口才、是非、深入鑽研的能力，觀察力極其敏銳，適合以口業（律師、老師）或深入的研究謀生。',
    '天相': '【天相星】代表印星，個性熱心熱誠、重視儀表與體面，具有輔佐的才幹與強烈的正義感，是極佳的輔佐人才。',
    '天梁': '【天梁星】為蔭星，代表成熟穩重、喜歡照顧晚輩、具有逢凶化吉的特質，帶有長者風範與清高的氣質。',
    '七殺': '【七殺星】代表權威與變動，個性質接、衝動、充滿開創力，人生大起大落，具備將帥之才，不服輸。',
    '破軍': '【破軍星】代表破壞與重生，個性不按牌理出牌、喜歡創新求變，具有強大的破壞力與重建執行力，適合開疆闢土。'
  };

  const mutagenMeanings = {
    '祿': '<strong>【化祿】(豐盛/緣分)</strong>：帶來順利、財富與好人緣，使該星曜的正能量最大化，發展機會與福報無窮。',
    '權': '<strong>【化權】(權力/掌控)</strong>：帶來威望、掌控力與行動力，代表實質的決策權與強烈企圖心。',
    '科': '<strong>【化科】(名聲/逢凶化吉)</strong>：帶來名望、貴人與學習能力，能因才華或學識獲得肯定，事情多能平順發展。',
    '忌': '<strong>【化忌】(執著/考驗)</strong>：代表執著、阻礙、變動與考驗，是需要克服的課題，但也可能成為最大的動力。'
  };

  const dualStarMeanings = {
    '紫微,天府': '【紫府雙星】強強聯手，氣勢驚人。極具企圖心與理財能力，是一方之霸的格局，但也容易有「一山不容二虎」的內在矛盾，宜培養包容心。',
    '紫微,七殺': '【紫殺雙星】化殺為權，魄力無雙。具備披荊斬棘的開創力，人生經歷大風大浪後必能成就一番偉業。',
    '紫微,天相': '【紫相雙星】穩重且具威儀，善於協調與管理，是絕佳的高階主管或幕僚長。',
    '紫微,破軍': '【紫破雙星】破舊立新，極具叛逆與創新精神。人生起伏較大，適合在新興領域或動盪環境中稱王。',
    '紫微,貪狼': '【紫貪雙星】桃花與慾望的結合，交際手腕極佳，多才多藝，但在感情或金錢上需懂得節制。',
    '天機,太陰': '【機月雙星】心思細膩度極高，柔和且具備優異的企劃與分析能力，但也容易多愁善感、思慮過度。',
    '天機,巨門': '【機巨雙星】口才與邏輯的極致展現。聰明機警，適合需要大量動腦與溝通分析的產業，需注意口舌是非。',
    '天機,天梁': '【機梁雙星】長者風範加上聰穎機變，擅長運籌帷幄，也是極佳的軍師或顧問型人才，為人較清高。',
    '太陽,太陰': '【日月雙星】光暗交織，性格兼具熱情與細膩。人生常有戲劇性的轉折，需在動態平衡中尋求內心安定。',
    '太陽,巨門': '【巨日雙星】光明與口才的結合，極具說服力，適合從事教育、法律、外交或跨國企業，能在異地發光發熱。',
    '太陽,天梁': '【陽梁雙星】光明與庇蔭的象徵。充滿正義感且熱心助人，適合從事公眾事務、醫療或社會服務。',
    '武曲,天府': '【武府雙星】財星與庫星同宮，極具理財與賺錢天賦。務實且穩健，擁有強大的資產累積能力。',
    '武曲,天相': '【武相雙星】剛柔並濟，忠誠且具有執行力，同時兼顧理財與公關協調，是可靠的全方位人才。',
    '武曲,七殺': '【武殺雙星】剛烈無比，極度果決與行動派。為了目標不擇手段，人生波折多但成就往往十分驚人。',
    '武曲,破軍': '【武破雙星】破壞力與執行力的結合，動盪與變革的推手。適合從事軍警、工程或高風險高報酬行業。',
    '武曲,貪狼': '【武貪格局】著名的發家格局，早年多波折，中年後一旦抓住機遇必定暴發，擅長交際與投資。',
    '天同,巨門': '【同巨雙星】內心時常有矛盾感，既想安逸又容易看到問題。若能發揮巨門的鑽研結合天同的隨和，可成專家。',
    '天同,天梁': '【同梁雙星】福氣與逢凶化吉的結合。人緣首屈一指，帶有長輩緣，生活平穩，但容易缺乏強烈企圖心。',
    '天同,太陰': '【同月雙星】極度溫柔、浪漫與細膩。美感極佳，適合從事藝術、設計或美學相關產業，但行動力較弱。',
    '廉貞,天府': '【廉府雙星】才華洋溢且穩重管理，公關手腕高明，能穩健地拓展人脈與版圖，適合大型企業或機關。',
    '廉貞,天相': '【廉相雙星】高度的責任感與公關魅力。長袖善舞，極具政治手腕，能在複雜的人際網中游刃有餘。',
    '廉貞,七殺': '【廉殺雙星】帶有極強的傲氣與衝勁。行事風格強烈，能承擔極大壓力，但也容易與人發生衝突。',
    '廉貞,破軍': '【廉破雙星】高度多變與不穩定。創造力極強但破壞力也大，人生多起伏，需在顛覆中尋找自我價值。',
    '廉貞,貪狼': '【廉貪雙星】兩大桃花星同宮，魅力四射。交際能力堪稱紫微之冠，才藝多且慾望強，需妥善管理男女關係。'
  };

  const minorStarMeanings = {
    '文昌': '<strong>【吉星】</strong>代表正統文歷與考試運。增強邏輯思考、文書處理與學習能力，使該宮位表現更為文雅理智。',
    '文曲': '<strong>【吉星】</strong>代表才藝與口才。增強藝術天分、溝通表達與直覺，使該宮位表現更為靈活多變。',
    '左輔': '<strong>【吉星】</strong>代表平輩貴人與正向助力。能增加該宮位的穩定度與資源，做事踏實，易得他人支持。',
    '右弼': '<strong>【吉星】</strong>代表非主流或異性平輩貴人。增強桃花人緣與靈活性，帶來意想不到的助力與圓融。',
    '天魁': '<strong>【吉星】</strong>代表陽性或長輩貴人。容易在危難時得到直接的實質幫助，為該宮位帶來逢凶化吉之效。',
    '天鉞': '<strong>【吉星】</strong>代表陰性或異性長輩貴人。貴人助力常是暗中相助，同時也會增強該宮位的異性緣。',
    '祿存': '<strong>【吉星】</strong>代表實質財富與穩固。能顯著增加該宮位的資源與安定感，具有強大的解厄功能，但也帶有保守特質。',
    '天馬': '<strong>【吉星】</strong>代表動能與變遷。會加速並擴大該宮位的狀況，帶來奔波、向外發展與強大活動力。',
    '擎羊': '<strong>【煞星】</strong>具有強大破壞力與衝勁的「明箭」。雖會帶來波折與傷害，但也賦予極強的開創力與無畏的執行力。',
    '陀羅': '<strong>【煞星】</strong>代表反覆拖延與鑽牛角尖的「暗箭」。導致這方面的發展猶豫原地打轉，但也賦予極強的韌性。',
    '火星': '<strong>【煞星】</strong>代表突發性的脾氣與激烈波折。容易在此宮位展現急躁衝動，但突發的爆發力與行動力驚人。',
    '鈴星': '<strong>【煞星】</strong>代表內隱的、持續性的精神煎熬。會帶來暗中的波折與算計，但也賦予驚人的意志力與深沉心機。',
    '地空': '<strong>【煞星】</strong>代表精神上的超脫與空虛。常有破財、虛幻或半途而廢的現象，但極具宗教天分與天馬行空的創意。',
    '地劫': '<strong>【煞星】</strong>代表物質上的劫奪與破耗。容易在財務或實質面上遭受無預警的挫折，需學習拿得起放得下。'
  };

  function getPalaceInfo(palace) {
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
        html += `<p style="margin-bottom: 6px;">${text} - ${starMeanings[star.name] || '此星曜影響該宮位走向。'}</p>`;
        if (star.mutagen && mutagenMeanings[star.mutagen]) {
           html += `<p style="margin-bottom: 12px; font-size: 0.9em; color:#b91c1c;">${mutagenMeanings[star.mutagen]}</p>`;
        }
      });
      
      // 判斷雙主星格局
      if (majors.length === 2) {
        const k1 = majors[0].name + ',' + majors[1].name;
        const k2 = majors[1].name + ',' + majors[0].name;
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
        if (star.mutagen && mutagenMeanings[star.mutagen]) {
           html += `<p style="margin-bottom: 8px; font-size: 0.85em; color:#b91c1c; padding-left: 10px;">> ${mutagenMeanings[star.mutagen]}</p>`;
        }
      }
    });

    return html;
  }

  function renderChart(ast, name, birthday, birthtimeStr) {
    const oldPalaces = chartGrid.querySelectorAll('.palace');
    oldPalaces.forEach(p => p.remove());

    infoName.innerText = name;
    displayName.innerText = name + ' 的命盤';
    infoSolar.innerText = birthday + ' ' + birthtimeStr;
    infoLunar.innerText = ast.lunarDate;
    infoElement.innerText = ast.fiveElementsClass;

    ast.palaces.forEach(palace => {
      const palDiv = document.createElement('div');
      palDiv.className = `palace palace-${palace.earthlyBranch}`;

      const starsDiv = document.createElement('div');
      starsDiv.className = 'stars-container';

      palace.majorStars.forEach(star => {
        const span = document.createElement('span');
        span.className = 'star major';
        // Add Mutagen if present e.g. 紫微化權
        let text = star.name;
        if (star.mutagen) text += star.mutagen;
        span.innerText = text;
        starsDiv.appendChild(span);
      });

      palace.minorStars.forEach(star => {
        const span = document.createElement('span');
        span.className = 'star minor';
        let text = star.name;
        if (star.mutagen) text += star.mutagen;
        span.innerText = text;
        starsDiv.appendChild(span);
      });
      
      palDiv.appendChild(starsDiv);

      const branchLabel = document.createElement('div');
      branchLabel.className = 'branch-label';
      branchLabel.innerText = palace.earthlyBranch;
      palDiv.appendChild(branchLabel);

      const nameLabel = document.createElement('div');
      nameLabel.className = 'palace-name-label';
      nameLabel.innerText = palace.name;
      palDiv.appendChild(nameLabel);

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
            tooltip.innerHTML = `<button id="close-tooltip-btn" class="close-tooltip-btn">✕</button><h4>${palace.name} (${palace.earthlyBranch}宮)</h4>` + getPalaceInfo(palace);
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
            tooltip.innerHTML = `<h4>${palace.name} (${palace.earthlyBranch}宮)</h4>` + getPalaceInfo(palace);
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
      const link = document.createElement('a');
      link.download = `命盤_${infoName.innerText}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Canvas error:', e);
      alert('產生圖片失敗！');
    }
    btnDownload.innerText = '📸 儲存命盤圖片';
  });

  btnLineShare.addEventListener('click', () => {
    if (!currentShareText) return;
    const encoded = encodeURIComponent(currentShareText);
    // Use the official LINE share endpoint which handles web fallbacks better
    window.open(`https://line.me/R/share?text=${encoded}`, '_blank');
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
      let interpretationHtml = '';

      // Major Stars Interpretation
      if (majorStars.length > 0) {
        majorStars.forEach(star => {
          let text = star.name;
          if (star.mutagen) text += star.mutagen;
          evidenceArr.push('主星：' + text);
          
          interpretationHtml += `<p style="margin-bottom: 12px;"><strong>【${star.name}】</strong>${starMeanings[star.name] || '此星曜影響該宮位走向。'}</p>`;
          if (star.mutagen && mutagenMeanings[star.mutagen]) {
             interpretationHtml += `<p style="margin-bottom: 12px; color: #b91c1c; padding-left: 14px; border-left: 3px solid #fca5a5;">${star.name}發生轉化，${mutagenMeanings[star.mutagen]}</p>`;
          }
        });

        // 判斷雙主星格局
        if (majorStars.length === 2) {
          const k1 = majorStars[0].name + ',' + majorStars[1].name;
          const k2 = majorStars[1].name + ',' + majorStars[0].name;
          const comboMeaning = dualStarMeanings[k1] || dualStarMeanings[k2];
          if (comboMeaning) {
            interpretationHtml += `
              <div style="background: #fdf2f8; border-left: 4px solid #db2777; padding: 12px; margin-top: 14px; margin-bottom: 14px; border-radius: 0 4px 4px 0;">
                <p style="color: #9d174d; margin: 0;"><strong>【雙星共振效應】</strong>${comboMeaning}</p>
              </div>`;
          }
        }

      } else {
        evidenceArr.push('空宮 (無主星)');
        interpretationHtml += `<p style="margin-bottom: 12px; color: #64748b;">此宮位為<strong>空宮</strong>，代表在此領域中您的可塑性大，容易受外界環境或他人影響，變化多端。建議參考對宮的主星來做綜合判斷。</p>`;
      }

      // Minor stars interpretation (吉凶星與四化)
      let minorHtmls = [];
      minorStars.forEach(star => {
        let text = star.name;
        let isImportant = false;
        let minorText = '';
        
        if (minorStarMeanings[star.name]) {
          isImportant = true;
          minorText += `<p style="margin-bottom: 6px; font-size: 0.95em;">${minorStarMeanings[star.name]}</p>`;
          evidenceArr.push(text);
        }

        if (star.mutagen) {
          isImportant = true;
          text += star.mutagen;
          minorText += `<p style="margin-bottom: 6px; font-size: 0.95em; color: #b91c1c;">輔星${star.name}發生轉化，${mutagenMeanings[star.mutagen]}</p>`;
          if (!evidenceArr.includes(star.name)) {
            evidenceArr.push(text);
          } else {
            evidenceArr[evidenceArr.length - 1] = text;
          }
        }

        if (isImportant) {
          minorHtmls.push(minorText);
        }
      });

      if (minorHtmls.length > 0) {
        interpretationHtml += `
          <div style="margin-top: 16px; padding-top: 12px; border-top: 1px dashed #cbd5e1;">
            <p style="margin-bottom: 8px; color: #475569; font-weight: bold;">✦ 輔助星曜影響：</p>
            ${minorHtmls.join('')}
          </div>
        `;
      }

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
