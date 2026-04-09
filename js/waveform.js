(function() {
        var wfCanvas = document.getElementById('waveform-canvas');
        var wfCtx = wfCanvas.getContext('2d');
        var b1Canvas = document.getElementById('waveform-beat1');
        var b1Ctx = b1Canvas.getContext('2d');
        var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        window.sharedAudioCtx = audioCtx;

        function resizeWf() {
          wfCanvas.width = wfCanvas.offsetWidth * (window.devicePixelRatio || 1);
          wfCanvas.height = wfCanvas.offsetHeight * (window.devicePixelRatio || 1);
          b1Canvas.width = b1Canvas.offsetWidth * (window.devicePixelRatio || 1);
          b1Canvas.height = b1Canvas.offsetHeight * (window.devicePixelRatio || 1);
        }
        resizeWf();
        window.addEventListener('resize', function() { resizeWf(); drawWaveform(wfData); });
        window.resizeB1 = resizeWf;

        var wfData = null;
        var wfDuration = 0;
        var windowPos = 0;

        function roundRect(ctx, x, y, w, h, r) {
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + w - r, y);
          ctx.arcTo(x + w, y, x + w, y + r, r);
          ctx.lineTo(x + w, y + h - r);
          ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
          ctx.lineTo(x + r, y + h);
          ctx.arcTo(x, y + h, x, y + h - r, r);
          ctx.lineTo(x, y + r);
          ctx.arcTo(x, y, x + r, y, r);
          ctx.closePath();
        }
        window.roundRect = roundRect;

        function drawWaveform(data) {
          if (!data || !wfDuration) return;
          var w = wfCanvas.width;
          var h = wfCanvas.height;
          var dpr = window.devicePixelRatio || 1;
          wfCtx.clearRect(0, 0, w, h);

          var len = data.length;
          var barW = 4 * dpr;
          var gap = 4 * dpr;
          var totalBars = Math.floor(w / (barW + gap));
          var step = Math.ceil(len / totalBars);
          var mid = h / 2;
          var barRadius = barW / 2;

          for (var i = 0; i < totalBars; i++) {
            var x = i * (barW + gap);
            var start = i * step;
            var end = Math.min(start + step, len);
            var sum = 0;
            for (var j = start; j < end; j++) {
              sum += data[j] * data[j];
            }
            var rms = Math.sqrt(sum / (end - start));
            var barH = Math.max(2 * dpr, Math.pow(rms, 0.5) * mid * 0.9);
            var y = mid - barH / 2;

            var grad = wfCtx.createLinearGradient(0, y, 0, y + barH);
            grad.addColorStop(0, '#00e5ff');
            grad.addColorStop(1, '#007aad');
            wfCtx.fillStyle = grad;
            wfCtx.beginPath();
            wfCtx.moveTo(x + barRadius, y);
            wfCtx.lineTo(x + barW - barRadius, y);
            wfCtx.arcTo(x + barW, y, x + barW, y + barRadius, barRadius);
            wfCtx.lineTo(x + barW, y + barH - barRadius);
            wfCtx.arcTo(x + barW, y + barH, x + barW - barRadius, y + barH, barRadius);
            wfCtx.lineTo(x + barRadius, y + barH);
            wfCtx.arcTo(x, y + barH, x, y + barH - barRadius, barRadius);
            wfCtx.lineTo(x, y + barRadius);
            wfCtx.arcTo(x, y, x + barRadius, y, barRadius);
            wfCtx.closePath();
            wfCtx.fill();
          }

          if (wfDuration > 0) {
            var windowW = (30 / wfDuration) * w;
            var windowX = windowPos * (w - windowW);
            var radius = 10 * dpr;

            wfCtx.fillStyle = 'rgba(255, 255, 255, 0.12)';
            roundRect(wfCtx, windowX, 0, windowW, h, radius);
            wfCtx.fill();

            wfCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            wfCtx.lineWidth = 2 * dpr;
            roundRect(wfCtx, windowX, 0, windowW, h, radius);
            wfCtx.stroke();
          }

          drawBeat1(data);
        }

        function drawBeat1(data) {
          if (!data || wfDuration === 0) return;
          var zw = b1Canvas.width;
          var zh = b1Canvas.height;
          var dpr = window.devicePixelRatio || 1;
          b1Ctx.clearRect(0, 0, zw, zh);

          var len = data.length;
          var startSample = Math.floor((windowPos * (wfDuration - 30)) / wfDuration * len);
          var endSample = Math.floor(((windowPos * (wfDuration - 30)) + 30) / wfDuration * len);
          var sampleRange = endSample - startSample;

          var totalBars = 30;
          var isPortrait = window.innerHeight > window.innerWidth;
          var gap = (isPortrait ? 2.5 : 5) * dpr;
          var barW = Math.max(2 * dpr, (zw - gap * (totalBars - 1)) / totalBars);
          var step = Math.ceil(sampleRange / totalBars);
          var mid = zh / 2;
          var barRadius = barW / 2;

          var barHeights = [];

          for (var i = 0; i < totalBars; i++) {
            var x = i * (barW + gap);
            var s = startSample + i * step;
            var e = Math.min(s + step, endSample, len);
            if (s >= len) break;
            var sum = 0;
            var count = 0;
            for (var j = s; j < e; j++) {
              sum += data[j] * data[j];
              count++;
            }
            var rms = count > 0 ? Math.sqrt(sum / count) : 0;
            var barH = Math.max(2 * dpr, Math.pow(rms, 0.7) * mid * 2.2);
            var y = mid - barH / 2;
            barHeights.push({ i: i, h: barH, x: x, y: y });

            var grad = b1Ctx.createLinearGradient(0, y, 0, y + barH);
            if (i < 7) {
              grad.addColorStop(0, '#7a8f93');
              grad.addColorStop(1, '#6a7b80');
            } else {
              grad.addColorStop(0, '#00e5ff');
              grad.addColorStop(1, '#007aad');
            }
            b1Ctx.fillStyle = grad;
            b1Ctx.beginPath();
            b1Ctx.moveTo(x + barRadius, y);
            b1Ctx.lineTo(x + barW - barRadius, y);
            b1Ctx.arcTo(x + barW, y, x + barW, y + barRadius, barRadius);
            b1Ctx.lineTo(x + barW, y + barH - barRadius);
            b1Ctx.arcTo(x + barW, y + barH, x + barW - barRadius, y + barH, barRadius);
            b1Ctx.lineTo(x + barRadius, y + barH);
            b1Ctx.arcTo(x, y + barH, x, y + barH - barRadius, barRadius);
            b1Ctx.lineTo(x, y + barRadius);
            b1Ctx.arcTo(x, y, x + barRadius, y, barRadius);
            b1Ctx.closePath();
            b1Ctx.fill();
          }

          var colored = barHeights.filter(function(b) { return b.i >= 7; });
          colored.sort(function(a, b) { return b.h - a.h; });
          var spikes = [];
          for (var si = 0; si < colored.length && spikes.length < 3; si++) {
            var candidate = colored[si];
            var tooClose = spikes.some(function(s) { return Math.abs(s.i - candidate.i) < 4; });
            if (!tooClose) spikes.push(candidate);
          }
          window.beat1Spikes = spikes.map(function(s) { return s.i; });
          b1Ctx.shadowColor = '#00ffff';
          b1Ctx.shadowBlur = 14 * dpr;
          spikes.forEach(function(sp) {
            var grad2 = b1Ctx.createLinearGradient(0, sp.y, 0, sp.y + sp.h);
            grad2.addColorStop(0, '#80ffff');
            grad2.addColorStop(1, '#33d6ff');
            b1Ctx.fillStyle = grad2;
            b1Ctx.beginPath();
            b1Ctx.moveTo(sp.x + barRadius, sp.y);
            b1Ctx.lineTo(sp.x + barW - barRadius, sp.y);
            b1Ctx.arcTo(sp.x + barW, sp.y, sp.x + barW, sp.y + barRadius, barRadius);
            b1Ctx.lineTo(sp.x + barW, sp.y + sp.h - barRadius);
            b1Ctx.arcTo(sp.x + barW, sp.y + sp.h, sp.x + barW - barRadius, sp.y + sp.h, barRadius);
            b1Ctx.lineTo(sp.x + barRadius, sp.y + sp.h);
            b1Ctx.arcTo(sp.x, sp.y + sp.h, sp.x, sp.y + sp.h - barRadius, barRadius);
            b1Ctx.lineTo(sp.x, sp.y + barRadius);
            b1Ctx.arcTo(sp.x, sp.y, sp.x + barRadius, sp.y, barRadius);
            b1Ctx.closePath();
            b1Ctx.fill();
          });
          b1Ctx.shadowBlur = 0;

          if (window.beat1Placements) {
            var zWindowStart = windowPos * (wfDuration - 30);
            var zWindowEnd = zWindowStart + 30;
            var typeColors = { ATTACK: 'rgba(140, 50, 200, 0.6)', DEFENSE: 'rgba(120, 120, 120, 0.6)', SKILL: 'rgba(200, 170, 50, 0.6)' };
            var typeBorders = { ATTACK: 'rgba(180, 80, 240, 0.8)', DEFENSE: 'rgba(160, 160, 160, 0.8)', SKILL: 'rgba(230, 200, 60, 0.8)' };
            window.beat1Placements.forEach(function(p) {
              var px = ((p.tick - 1) / 30) * zw;
              var pw = (p.time / 30) * zw;
              var pr = 6 * dpr;
              var blockH = zh * 0.8;
              var blockY = (zh - blockH) / 2;
              b1Ctx.fillStyle = typeColors[p.type];
              window.roundRect(b1Ctx, px, blockY, pw, blockH, pr);
              b1Ctx.fill();
              b1Ctx.strokeStyle = typeBorders[p.type];
              b1Ctx.lineWidth = 2 * dpr;
              window.roundRect(b1Ctx, px, blockY, pw, blockH, pr);
              b1Ctx.stroke();

              b1Ctx.fillStyle = 'rgba(255,255,255,0.9)';
              b1Ctx.font = '500 ' + (10 * dpr) + 'px "Exo 2", sans-serif';
              b1Ctx.textAlign = 'center';
              b1Ctx.textBaseline = 'middle';
              b1Ctx.fillText(p.name, px + pw / 2, zh / 2);
            });
          }

          if (window.dragPreview && window.dragPreview.canvas === 'beat1') {
            var dp = window.dragPreview;
            var dpx = dp.bar * zw;
            var dpw = (dp.time / 30) * zw;
            var dpr2 = 6 * dpr;
            var dpH = zh * 0.8;
            var dpY = (zh - dpH) / 2;
            if (dp.overlap) {
              b1Ctx.fillStyle = 'rgba(220, 40, 40, 0.35)';
              b1Ctx.strokeStyle = 'rgba(255, 80, 80, 0.7)';
            } else {
              var colors = { ATTACK: 'rgba(140, 50, 200, 0.35)', DEFENSE: 'rgba(120, 120, 120, 0.35)', SKILL: 'rgba(200, 170, 50, 0.35)' };
              b1Ctx.fillStyle = colors[dp.type];
              b1Ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            }
            window.roundRect(b1Ctx, dpx, dpY, dpw, dpH, dpr2);
            b1Ctx.fill();
            b1Ctx.setLineDash([4 * dpr, 4 * dpr]);
            b1Ctx.lineWidth = 2 * dpr;
            window.roundRect(b1Ctx, dpx, dpY, dpw, dpH, dpr2);
            b1Ctx.stroke();
            b1Ctx.setLineDash([]);
          }
        }

        fetch('resources/Beat1.mp3')
          .then(function(r) { return r.arrayBuffer(); })
          .then(function(buf) { return audioCtx.decodeAudioData(buf); })
          .then(function(audioBuffer) {
            wfData = audioBuffer.getChannelData(0);
            wfDuration = audioBuffer.duration;
            window.wfData = wfData;
            window.wfDuration = wfDuration;
            window.beat1Buffer = audioBuffer;
            drawWaveform(wfData);
            if (window.updateHealthWaveforms) window.updateHealthWaveforms();
          });

        var dragging = false;

        function getCanvasX(e) {
          var rect = wfCanvas.getBoundingClientRect();
          var clientX = e.touches ? e.touches[0].clientX : e.clientX;
          return (clientX - rect.left) / rect.width;
        }

        wfCanvas.style.cursor = 'pointer';
        var snippetLocked = false;

        wfCanvas.addEventListener('mousedown', function(e) {
          if (snippetLocked) return;
          dragging = true;
          windowPos = Math.max(0, Math.min(1, getCanvasX(e)));
          drawWaveform(wfData);
          updateDragGhostTime();
        });
        window.addEventListener('mousemove', function(e) {
          if (!dragging || snippetLocked) return;
          windowPos = Math.max(0, Math.min(1, getCanvasX(e)));
          drawWaveform(wfData);
          updateDragGhostTime();
        });
        window.addEventListener('mouseup', function() { dragging = false; });

        wfCanvas.addEventListener('touchstart', function(e) {
          if (snippetLocked) return;
          dragging = true;
          windowPos = Math.max(0, Math.min(1, getCanvasX(e)));
          drawWaveform(wfData);
          updateDragGhostTime();
        }, { passive: true });
        window.addEventListener('touchmove', function(e) {
          if (!dragging || snippetLocked) return;
          windowPos = Math.max(0, Math.min(1, getCanvasX(e)));
          drawWaveform(wfData);
          updateDragGhostTime();
        }, { passive: true });
        window.addEventListener('touchend', function() { dragging = false; });

      var moveDurations = { PUNCH: 1, 'PUNCH+': 1, BLOCK: 1, SUPER: 1, TAUNT: 1, TAUNT_DEFAULT: 1, CONT: 1 };

        window.beat1Placements = [];
        window.redrawWaveforms = function() { drawWaveform(wfData); updateMoveSeq('move-seq-1', window.beat1Placements); if (window.debugEnabled) { window.updateDebugTimeline(); } };

        window.updateMoveSeq = function(elId, placements) {
          var el = document.getElementById(elId);
          var sorted = placements.slice().sort(function(a, b) { return a.tick - b.tick; });
          var moves = [];
          var prevMove = null;
          sorted.forEach(function(p) {
            if (p.moves) {
              p.moves.forEach(function(m, idx) {

                if (m === 'PUNCH' && p.onSpike && idx === 0) {
                  moves.push('PUNCH+');
                  prevMove = 'PUNCH+';
                } else if (m === 'PUNCH' && prevMove === 'TAUNT') {
                  moves.push('PUNCH+');
                  prevMove = 'PUNCH+';
                } else if (m !== 'IDLE' && m !== 'CONT') {
                  moves.push(m);
                  prevMove = m;
                }
              });
            }
          });

          el.innerHTML = moves.map(function(m) {
            var cls = m === 'PUNCH+' ? 'move-seq-item move-plus' : 'move-seq-item';
            return '<span class="' + cls + '">' + m + '</span>';
          }).join('');

          if (window.beat1Placements.length > 0 && window.beat2Placements.length > 0) {
            document.getElementById('start-btn').disabled = false;
          } else {
            document.getElementById('start-btn').disabled = true;
          }
        };
        window.getBeat1WindowPos = function() { return windowPos; };
        window.getBeat1Duration = function() { return wfDuration; };
        window.getBeat1Data = function() { return wfData; };
        window.lockSnippet = function() { snippetLocked = true; wfCanvas.style.cursor = 'default'; };
        
        function formatTime(seconds) {
          var mins = Math.floor(seconds / 60);
          var secs = Math.floor(seconds % 60);
          return mins + ':' + (secs < 10 ? '0' : '') + secs;
        }
        
        window.updateDragGhostTime = function() {
          var display = document.getElementById('snippet-time-display');
          if (!display) return;
          display.style.display = 'block';
          var snippetStartSeconds = windowPos * (wfDuration - 30);
          var totalSeconds = wfDuration;
          display.textContent = formatTime(snippetStartSeconds) + ' / ' + formatTime(totalSeconds);
        };

        var b2Canvas = document.getElementById('waveform-beat2');
        var b2Ctx = b2Canvas.getContext('2d');

        function resizeB2() {
          b2Canvas.width = b2Canvas.offsetWidth * (window.devicePixelRatio || 1);
          b2Canvas.height = b2Canvas.offsetHeight * (window.devicePixelRatio || 1);
        }
        window.resizeB2 = resizeB2;
        resizeB2();
        window.addEventListener('resize', function() { 
          resizeB2(); 
          drawBeat2(window.b2Data, b2Start); 
        });

        var b2Data = null;
        var b2Start = 0;
        var b2Duration = 0;

        function drawBeat2(data, startSample) {
          var useData = data || window.b2Data;
          var useDuration = window.b2Duration;
          if (!useData || !useDuration) return;
          var w = b2Canvas.width;
          var h = b2Canvas.height;
          var dpr = window.devicePixelRatio || 1;
          b2Ctx.clearRect(0, 0, w, h);

          var len = useData.length;
          var sampleRange = Math.floor(30 / useDuration * len);
          var endSample = Math.min(startSample + sampleRange, len);

          var totalBars = 30;
          var isPortrait = window.innerHeight > window.innerWidth;
          var gap = (isPortrait ? 2.5 : 5) * dpr;
          var barW = Math.max(2 * dpr, (w - gap * (totalBars - 1)) / totalBars);
          var step = Math.ceil(sampleRange / totalBars);
          var mid = h / 2;
          var barRadius = barW / 2;

          var barHeights = [];

          for (var i = 0; i < totalBars; i++) {
            var x = i * (barW + gap);
            var s = startSample + i * step;
            var e = Math.min(s + step, endSample, len);
            if (s >= len) break;
            var sum = 0;
            var count = 0;
            for (var j = s; j < e; j++) {
              sum += useData[j] * useData[j];
              count++;
            }
            var rms = count > 0 ? Math.sqrt(sum / count) : 0;
            var barH = Math.max(2 * dpr, Math.pow(rms, 0.7) * mid * 2.2);
            var y = mid - barH / 2;
            barHeights.push({ i: i, h: barH, x: x, y: y });

            var grad = b2Ctx.createLinearGradient(0, y, 0, y + barH);
            if (i < 7) {
              grad.addColorStop(0, '#8a7a7d');
              grad.addColorStop(1, '#6e5f62');
            } else {
              grad.addColorStop(0, '#fc6c85');
              grad.addColorStop(1, '#7a1a3a');
            }
            b2Ctx.fillStyle = grad;
            b2Ctx.beginPath();
            b2Ctx.moveTo(x + barRadius, y);
            b2Ctx.lineTo(x + barW - barRadius, y);
            b2Ctx.arcTo(x + barW, y, x + barW, y + barRadius, barRadius);
            b2Ctx.lineTo(x + barW, y + barH - barRadius);
            b2Ctx.arcTo(x + barW, y + barH, x + barW - barRadius, y + barH, barRadius);
            b2Ctx.lineTo(x + barRadius, y + barH);
            b2Ctx.arcTo(x, y + barH, x, y + barH - barRadius, barRadius);
            b2Ctx.lineTo(x, y + barRadius);
            b2Ctx.arcTo(x, y, x + barRadius, y, barRadius);
            b2Ctx.closePath();
            b2Ctx.fill();
          }

          var colored = barHeights.filter(function(b) { return b.i >= 7; });
          colored.sort(function(a, b) { return b.h - a.h; });
          var spikes = [];
          for (var si = 0; si < colored.length && spikes.length < 3; si++) {
            var candidate = colored[si];
            var tooClose = spikes.some(function(s) { return Math.abs(s.i - candidate.i) < 4; });
            if (!tooClose) spikes.push(candidate);
          }
          window.beat2Spikes = spikes.map(function(s) { return s.i; });
          b2Ctx.shadowColor = '#ff80a0';
          b2Ctx.shadowBlur = 14 * dpr;
          spikes.forEach(function(sp) {
            var grad2 = b2Ctx.createLinearGradient(0, sp.y, 0, sp.y + sp.h);
            grad2.addColorStop(0, '#ffa0b8');
            grad2.addColorStop(1, '#d63366');
            b2Ctx.fillStyle = grad2;
            b2Ctx.beginPath();
            b2Ctx.moveTo(sp.x + barRadius, sp.y);
            b2Ctx.lineTo(sp.x + barW - barRadius, sp.y);
            b2Ctx.arcTo(sp.x + barW, sp.y, sp.x + barW, sp.y + barRadius, barRadius);
            b2Ctx.lineTo(sp.x + barW, sp.y + sp.h - barRadius);
            b2Ctx.arcTo(sp.x + barW, sp.y + sp.h, sp.x + barW - barRadius, sp.y + sp.h, barRadius);
            b2Ctx.lineTo(sp.x + barRadius, sp.y + sp.h);
            b2Ctx.arcTo(sp.x, sp.y + sp.h, sp.x, sp.y + sp.h - barRadius, barRadius);
            b2Ctx.lineTo(sp.x, sp.y + barRadius);
            b2Ctx.arcTo(sp.x, sp.y, sp.x + barRadius, sp.y, barRadius);
            b2Ctx.closePath();
            b2Ctx.fill();
          });
          b2Ctx.shadowBlur = 0;

          if (window.beat2Placements) {
            var b2WindowStart = b2Start / len * b2Duration;
            var b2WindowEnd = b2WindowStart + 30;
            var typeColors = { ATTACK: 'rgba(140, 50, 200, 0.6)', DEFENSE: 'rgba(120, 120, 120, 0.6)', SKILL: 'rgba(200, 170, 50, 0.6)' };
            var typeBorders = { ATTACK: 'rgba(180, 80, 240, 0.8)', DEFENSE: 'rgba(160, 160, 160, 0.8)', SKILL: 'rgba(230, 200, 60, 0.8)' };
            window.beat2Placements.forEach(function(p) {
              var px = ((p.tick - 1) / 30) * w;
              var pw = (p.time / 30) * w;
              var pr = 6 * dpr;
              var blockH = h * 0.8;
              var blockY = (h - blockH) / 2;
              b2Ctx.fillStyle = typeColors[p.type];
              window.roundRect(b2Ctx, px, blockY, pw, blockH, pr);
              b2Ctx.fill();
              b2Ctx.strokeStyle = typeBorders[p.type];
              b2Ctx.lineWidth = 2 * dpr;
              window.roundRect(b2Ctx, px, blockY, pw, blockH, pr);
              b2Ctx.stroke();

              b2Ctx.fillStyle = 'rgba(255,255,255,0.9)';
              b2Ctx.font = '500 ' + (10 * dpr) + 'px "Exo 2", sans-serif';
              b2Ctx.textAlign = 'center';
              b2Ctx.textBaseline = 'middle';
              b2Ctx.fillText(p.name, px + pw / 2, h / 2);
            });
          }

          if (window.dragPreview && window.dragPreview.canvas === 'beat2') {
            var dp = window.dragPreview;
            var dpx = dp.bar * w;
            var dpw = (dp.time / 30) * w;
            var dpr2 = 6 * dpr;
            var dpH = h * 0.8;
            var dpY = (h - dpH) / 2;
            if (dp.overlap) {
              b2Ctx.fillStyle = 'rgba(220, 40, 40, 0.35)';
              b2Ctx.strokeStyle = 'rgba(255, 80, 80, 0.7)';
            } else {
              var colors = { ATTACK: 'rgba(140, 50, 200, 0.35)', DEFENSE: 'rgba(120, 120, 120, 0.35)', SKILL: 'rgba(200, 170, 50, 0.35)' };
              b2Ctx.fillStyle = colors[dp.type];
              b2Ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            }
            window.roundRect(b2Ctx, dpx, dpY, dpw, dpH, dpr2);
            b2Ctx.fill();
            b2Ctx.setLineDash([4 * dpr, 4 * dpr]);
            b2Ctx.lineWidth = 2 * dpr;
            window.roundRect(b2Ctx, dpx, dpY, dpw, dpH, dpr2);
            b2Ctx.stroke();
            b2Ctx.setLineDash([]);
          }
        }

        fetch('resources/Beat2.mp3')
          .then(function(r) { return r.arrayBuffer(); })
          .then(function(buf) { return window.sharedAudioCtx.decodeAudioData(buf); })
          .then(function(audioBuffer) {
            window.b2Data = audioBuffer.getChannelData(0);
            window.b2Duration = audioBuffer.duration;
            var maxStart = window.b2Data.length - Math.floor(30 / window.b2Duration * window.b2Data.length);
            window.b2Start = Math.floor(Math.random() * maxStart);
            b2Start = window.b2Start;
            b2Data = window.b2Data;
            b2Duration = window.b2Duration;
            window.beat2Buffer = audioBuffer;
            drawBeat2(window.b2Data, window.b2Start);
            if (window.updateHealthWaveforms) window.updateHealthWaveforms();
          });

        window.beat2Placements = [];
        window.redrawBeat2 = function() { 
          var useData = window.b2Data;
          var useDuration = window.b2Duration;
          if (useData && useDuration) {
            resizeB2();
            drawBeat2(useData, window.b2Start); 
          }
          updateMoveSeq('move-seq-2', window.beat2Placements); 
        };
        window.getBeat2Start = function() { return b2Start; };
      })();
    