(function() {
        var selectAudio = new Audio('resources/select.mp3');
        var pickAudio = new Audio('resources/pick.wav');
        var dropAudio = new Audio('resources/drop.wav');
        var confirmAudio = new Audio('resources/confirm.wav');
        var flushAudio = new Audio('resources/flush.mp3');
        var votingAudio = new Audio('resources/voting.mp3');
        var winnerP1Audio = new Audio('resources/winnerP1.mp3');
        var winnerP2Audio = new Audio('resources/winnerP2.mp3');
        var hypeAudio = new Audio('resources/hype.webm');

        var moveDescriptions = {
          'PUNCH': 'Light attack, interrupted by BLOCK. PUNCH+ Can\'t be interrupted by BLOCK',
          'PUNCH+': 'BOOSTED. Deals more damage and can\'t be blocked.',
          'BLOCK': 'Instant cast. Negates light strikes, such as PUNCH',
          'SUPER': '3 second cast. Instant kill. Interrupted with PUNCH',
          'TAUNT': 'Turns upcoming PUNCH into PUNCH+',
          'CONT': 'Super continues'
        };
        var typeDescriptions = {
          'ATTACK': 'Start this card on your BOOSTER to turn its first PUNCH into PUNCH+',
          'DEFENSE': 'Avoid opponent\'s BOOSTERS as those attacks can\'t be blocked',
          'SKILL': 'Boost upcoming moves. Can be played in both Intros and Sequences.'
        };
        var showCardInfo = false;

        var cards = [
          { name: 'Hit',            type: 'ATTACK',  time: 2, moves: ['PUNCH', 'IDLE'] },
          { name: 'Triple Hit',     type: 'ATTACK',  time: 5, moves: ['PUNCH', 'PUNCH', 'PUNCH', 'IDLE', 'IDLE'] },
          { name: 'Sucker Punch',   type: 'ATTACK',  time: 3, moves: ['BLOCK', 'PUNCH', 'IDLE'] },
          { name: 'Power Glove',    type: 'ATTACK',  time: 5, moves: ['SUPER', 'CONT', 'CONT', 'IDLE', 'CONT'] },
          { name: 'Doom',           type: 'ATTACK',  time: 8, moves: ['PUNCH', 'PUNCH', 'SUPER', 'CONT', 'CONT', 'IDLE', 'CONT', 'CONT'] },
          { name: 'Deflect',        type: 'DEFENSE', time: 2, moves: ['BLOCK', 'IDLE'] },
          { name: 'Turtle',         type: 'DEFENSE', time: 5, moves: ['BLOCK', 'PUNCH', 'BLOCK', 'IDLE', 'CONT'] },
          { name: 'Smartass',       type: 'DEFENSE', time: 5, moves: ['BLOCK', 'TAUNT', 'CONT', 'IDLE'] },
          { name: 'Wait For It', type: 'DEFENSE', time: 8, moves: ['BLOCK', 'BLOCK', 'SUPER', 'CONT', 'CONT', 'IDLE', 'CONT', 'CONT'] },
          { name: 'Boost Morale',   type: 'SKILL',   time: 3, moves: ['TAUNT', 'IDLE', 'IDLE'] }
        ];

        var box = document.getElementById('info-box');
        box.addEventListener('wheel', function(e) {
          if (window.innerHeight > window.innerWidth) return;
          e.preventDefault();
          var step = e.deltaY > 0 ? cardJump : -cardJump;
          smoothScrollTo(box.scrollLeft + step);
          selectAudio.currentTime = 0;
          selectAudio.play().catch(function() {});
        }, { passive: false });

        var cardJump = 130; // 120px card + 10px gap

        function smoothScrollTo(targetScroll) {
          selectAudio.currentTime = 0;
          selectAudio.play().catch(function() {});
          var startScroll = box.scrollLeft;
          var distance = targetScroll - startScroll;
          var duration = 150;
          var startTime = null;

          function animation(currentTime) {
            if (startTime === null) startTime = currentTime;
            var elapsed = currentTime - startTime;
            var progress = Math.min(elapsed / duration, 1);
            var easeProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            box.scrollLeft = startScroll + distance * easeProgress;
            if (progress < 1) {
              requestAnimationFrame(animation);
            }
          }
          requestAnimationFrame(animation);
        }

        document.getElementById('scroll-left-btn').addEventListener('click', function() {
          smoothScrollTo(Math.max(0, box.scrollLeft - cardJump));
        });

        document.getElementById('scroll-right-btn').addEventListener('click', function() {
          smoothScrollTo(box.scrollLeft + cardJump);
        });

        document.addEventListener('keydown', function(e) {
          if (e.key === 'ArrowLeft') {
            smoothScrollTo(Math.max(0, box.scrollLeft - cardJump));
            selectAudio.currentTime = 0;
            selectAudio.play().catch(function() {});
          } else if (e.key === 'ArrowRight') {
            smoothScrollTo(box.scrollLeft + cardJump);
            selectAudio.currentTime = 0;
            selectAudio.play().catch(function() {});
          }
        });

        var wfCanvas = document.getElementById('waveform-canvas');
        var b1Canvas = document.getElementById('waveform-beat1');
        var b2Canvas = document.getElementById('waveform-beat2');
        var ghost = document.getElementById('drag-ghost');
        var dragCard = null;
        var dragEl = null;

        var cardImages = {
          'Hit': 'hit',
          'Triple Hit': 'triple_hit',
          'Sucker Punch': 'sucker_punch',
          'Power Glove': 'power_glove',
          'Doom': 'doom',
          'Deflect': 'deflect',
          'Turtle': 'turtle',
          'Smartass': 'smartass',
          'Wait For It': 'wait_your_moment',
          'Boost Morale': 'boost_morale'
        };

        function createCardEl(c) {
          var imgFile = cardImages[c.name] || 'hit';
          var el = document.createElement('div');
          el.className = 'card type-' + c.type;
          el.innerHTML =
            '<div class="card-time-badge">' + c.time + '</div>' +
            '<div class="card-img"><img src="resources/cards/' + imgFile + '.webp" alt="' + c.name + '"></div>' +
            '<div class="card-name">' + c.name + '</div>' +
            '<div class="card-type">' + c.type + '</div>' +
            '<div class="card-moves">' + c.moves.filter(function(m) { return m !== 'IDLE' && m !== 'CONT'; }).map(function(m) { return '<span class="move-tag">' + m + '</span>'; }).join('') + '</div>';
            
          el.addEventListener('pointerdown', function(e) {
            e.preventDefault();
            pickAudio.currentTime = 0;
            pickAudio.play().catch(function() {});
            dragCard = c;
            dragEl = el;
            ghost.innerHTML = el.outerHTML;
            ghost.style.display = 'block';
            ghost.style.width = el.offsetWidth + 'px';
            ghost.style.left = e.clientX + 'px';
            ghost.style.top = e.clientY + 'px';
            el.style.opacity = '0.3';
          });
          return el;
        }

        cards.forEach(function(c) {
          box.appendChild(createCardEl(c));
        });

        window.addEventListener('pointermove', function(e) {
          if (!dragCard) return;
          ghost.style.left = e.clientX + 'px';
          ghost.style.top = e.clientY + 'px';

          if (window.showCardInfo && dragCard) {
            var infoBox = document.getElementById('drag-ghost-info');
            var typeDesc = window.typeDescriptions[dragCard.type] || '';
            var movesHtml = '';
            if (dragCard.moves) {
              var uniqueMoves = [...new Set(dragCard.moves.filter(function(m) { return m !== 'IDLE' && m !== 'CONT'; }))];
              uniqueMoves.forEach(function(m) {
                var desc = window.moveDescriptions[m] || '';
                movesHtml += '<div class="info-move-item"><span class="info-move-name">' + m + '</span><br><span class="info-move-desc">' + desc + '</span></div>';
              });
            }
            infoBox.innerHTML = '<div class="info-type ' + dragCard.type + '">' + dragCard.type + '</div>' +
              '<div style="color:rgba(255,255,255,0.7);margin-bottom:8px;font-size:11px;">' + typeDesc + '</div>' + movesHtml;
            infoBox.style.display = 'block';
            infoBox.style.left = (e.clientX - 140) + 'px';
            infoBox.style.top = (e.clientY + 120) + 'px';
          }

          var b1Rect = b1Canvas.getBoundingClientRect();
          var b2Rect = b2Canvas.getBoundingClientRect();
          window.dragPreview = null;

          if (e.clientX >= b1Rect.left && e.clientX <= b1Rect.right &&
              e.clientY >= b1Rect.top && e.clientY <= b1Rect.bottom) {
            var localPos = (e.clientX - b1Rect.left) / b1Rect.width;
            var snappedTick = Math.max(1, Math.min(30, Math.round(localPos * 30) + 1));
            var visualBar = (snappedTick - 1) / 30;
            var restricted = snappedTick < 8 && dragCard.type !== 'SKILL';
            var overflows = snappedTick + dragCard.time > 31;
            var overlaps = overflows || restricted || window.beat1Placements.some(function(p) {
              var pEnd = p.tick + p.time;
              return snappedTick < pEnd && snappedTick + dragCard.time > p.tick;
            });
            window.dragPreview = { canvas: 'beat1', bar: visualBar, time: dragCard.time, type: dragCard.type, name: dragCard.name, overlap: overlaps };
            window.redrawWaveforms();
          } else if (e.clientX >= b2Rect.left && e.clientX <= b2Rect.right &&
                     e.clientY >= b2Rect.top && e.clientY <= b2Rect.bottom) {
            var localPos2 = (e.clientX - b2Rect.left) / b2Rect.width;
            var snappedTick2 = Math.max(1, Math.min(30, Math.round(localPos2 * 30) + 1));
            var snappedBar2 = (snappedTick2 - 1) / 30;
            var overflows2 = snappedTick2 + dragCard.time > 31;
            var restricted2 = snappedTick2 < 8 && dragCard.type !== 'SKILL';
            var overlaps2 = overflows2 || restricted2 || window.beat2Placements.some(function(p) {
              var pEnd2 = p.tick + p.time;
              return snappedTick2 < pEnd2 && snappedTick2 + dragCard.time > p.tick;
            });
            window.dragPreview = { canvas: 'beat2', bar: snappedBar2, time: dragCard.time, type: dragCard.type, name: dragCard.name, overlap: overlaps2 };
            window.redrawBeat2();
          } else {
            window.redrawWaveforms();
            window.redrawBeat2();
          }
        });

        window.addEventListener('pointerup', function(e) {
          if (!dragCard) return;

          var ghostCard = ghost.querySelector('.card');
          if (ghostCard) ghostCard.style.transform = '';

          ghost.style.display = 'none';
          document.getElementById('drag-ghost-info').style.display = 'none';
          window.dragPreview = null;
          window.redrawWaveforms();
          window.redrawBeat2();

          var b1Rect = b1Canvas.getBoundingClientRect();
          var b2Rect = b2Canvas.getBoundingClientRect();

          var dropped = false;

          if (e.clientX >= b1Rect.left && e.clientX <= b1Rect.right &&
              e.clientY >= b1Rect.top && e.clientY <= b1Rect.bottom) {
            var localPos = (e.clientX - b1Rect.left) / b1Rect.width;
            var snappedTick = Math.max(1, Math.min(30, Math.round(localPos * 30) + 1));
            var restricted = snappedTick < 8 && dragCard.type !== 'SKILL';
            var overflows = snappedTick + dragCard.time > 31;
            var overlaps = overflows || restricted || window.beat1Placements.some(function(p) {
              var pEnd = p.tick + p.time;
              return snappedTick < pEnd && snappedTick + dragCard.time > p.tick;
            });
            if (!overlaps) {
              var onSpike = window.beat1Spikes && window.beat1Spikes.indexOf(snappedTick - 1) !== -1;
              var isFirst = window.beat1Placements.length === 0;
              window.beat1Placements.push({ name: dragCard.name, type: dragCard.type, time: dragCard.time, tick: snappedTick, moves: dragCard.moves, onSpike: onSpike });
              window.redrawWaveforms();
              if (isFirst) window.lockSnippet();
              dropped = true;
            }
          }

          if (!dropped &&
              e.clientX >= b2Rect.left && e.clientX <= b2Rect.right &&
              e.clientY >= b2Rect.top && e.clientY <= b2Rect.bottom) {
            var localPos2 = (e.clientX - b2Rect.left) / b2Rect.width;
            var snappedTick2 = Math.max(1, Math.min(30, Math.round(localPos2 * 30) + 1));
            var overflows2 = snappedTick2 + dragCard.time > 31;
            var restricted2 = snappedTick2 < 8 && dragCard.type !== 'SKILL';
            var overlaps2 = overflows2 || restricted2 || window.beat2Placements.some(function(p) {
              var pEnd2 = p.tick + p.time;
              return snappedTick2 < pEnd2 && snappedTick2 + dragCard.time > p.tick;
            });
            if (!overlaps2) {
              var onSpike2 = window.beat2Spikes && window.beat2Spikes.indexOf(snappedTick2 - 1) !== -1;
              window.beat2Placements.push({ name: dragCard.name, type: dragCard.type, time: dragCard.time, tick: snappedTick2, moves: dragCard.moves, onSpike: onSpike2 });
              window.redrawBeat2();
              dropped = true;
            }
          }

          if (dropped) {
            dropAudio.currentTime = 0;
            dropAudio.play().catch(function() {});
            dragEl.remove();
          } else {
            dragEl.style.opacity = '1';
          }

          dragCard = null;
          dragEl = null;
        });

        function addCardToBox(c) {
          box.appendChild(createCardEl(c));
        }

        b1Canvas.addEventListener('click', function(e) {
          if (window.beat1Placements.length === 0) return;
          var rect = b1Canvas.getBoundingClientRect();
          var localPos = (e.clientX - rect.left) / rect.width;
          var clickTick = Math.round(localPos * 30) + 1;

          for (var i = window.beat1Placements.length - 1; i >= 0; i--) {
            var p = window.beat1Placements[i];
            var pEnd = p.tick + p.time;
            if (clickTick >= p.tick && clickTick < pEnd) {
              window.beat1Placements.splice(i, 1);
              window.redrawWaveforms();
              addCardToBox({ name: p.name, type: p.type, time: p.time, moves: cards.find(function(c) { return c.name === p.name; }).moves });
              break;
            }
          }
        });

        b2Canvas.addEventListener('click', function(e) {
          if (window.beat2Placements.length === 0) return;
          var rect = b2Canvas.getBoundingClientRect();
          var clickTick = Math.round((e.clientX - rect.left) / rect.width * 30) + 1;

          for (var i = window.beat2Placements.length - 1; i >= 0; i--) {
            var p = window.beat2Placements[i];
            var pEnd = p.tick + p.time;
            if (clickTick >= p.tick && clickTick < pEnd) {
              window.beat2Placements.splice(i, 1);
              window.redrawBeat2();
              addCardToBox({ name: p.name, type: p.type, time: p.time, moves: cards.find(function(c) { return c.name === p.name; }).moves });
              break;
            }
          }
        });

        window.moveDescriptions = moveDescriptions;
        window.typeDescriptions = typeDescriptions;
        window.showCardInfo = showCardInfo;
        window.cards = cards;
      })();
    