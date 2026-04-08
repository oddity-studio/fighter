(function() {
        var b2Canvas = document.getElementById('waveform-beat2');
        var b2Ctx = b2Canvas.getContext('2d');
        var b2AudioCtx = new (window.AudioContext || window.webkitAudioContext)();

        function resizeB2() {
          b2Canvas.width = b2Canvas.offsetWidth * (window.devicePixelRatio || 1);
          b2Canvas.height = b2Canvas.offsetHeight * (window.devicePixelRatio || 1);
          console.log('resizeB2 called, width:', b2Canvas.width, 'height:', b2Canvas.height);
        }
        window.resizeB2 = resizeB2;
        resizeB2();
        window.addEventListener('resize', function() { 
          resizeB2(); 
          console.log('resize, using window.b2Data:', window.b2Data ? 'exists' : 'null');
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
            console.log('Beat2 audio loaded!');
            window.b2Data = audioBuffer.getChannelData(0);
            window.b2Duration = audioBuffer.duration;
            var maxStart = window.b2Data.length - Math.floor(30 / window.b2Duration * window.b2Data.length);
            window.b2Start = Math.floor(Math.random() * maxStart);
            window.beat2Buffer = audioBuffer;
            console.log('Setting window.b2Start:', window.b2Start);
            drawBeat2(window.b2Data, window.b2Start);
          });

        window.beat2Placements = [];
        window.redrawBeat2 = function() { 
          console.log('redrawBeat2 called, b2Data:', window.b2Data ? 'exists' : 'null', 'b2Duration:', window.b2Duration);
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
    
