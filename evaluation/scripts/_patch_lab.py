import re

# ------------------------------------------------------------------ HTML
p = 'backend/app/static/index.html'
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert a in s, a[:80]
    s = s.replace(a, b, 1)


# comparison tab: drop the legacy bar chart + hand-typed table (866 ms / 3.01x / 6,500 MB), show measured extras instead
a = s.index('            <!-- Grouped Bar Chart -->')
b = s.index('        </section>', s.index('<tbody>', a))
s = s[:a] + '''            <div id="research-extras"><p class="panel-description">Loading measured results...</p></div>
          </div>
''' + s[b:]

# failure tab: data-driven (from /api/v1/research/overview), no before/after stock pictures
a = s.index('        <section id="tab-failures" class="tab-panel">')
b = s.index('        <!-- ==================== TAB 8: CATALOGUE')
s = s[:a] + '''        <section id="tab-failures" class="tab-panel">
          <div class="dashboard-panel">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
              <div>
                <h2 class="sub-title">Failure analysis and lessons</h2>
                <p class="panel-description">What did not work, why, and what we did about it. Every number is read from the measured result files.</p>
              </div>
              <div class="filter-pills" id="failure-filters"></div>
            </div>
            <div class="failure-list" id="failure-container" style="max-width: 980px;"><p class="panel-description">Loading...</p></div>
          </div>
        </section>

''' + s[b:]

# about tab: measured headline numbers instead of the old 3.01x / 866 ms story
a = s.index('                <div class="viva-card">')
b = s.index('              </div>\n            </div>\n          </div>\n        </section>', a)
s = s[:a] + '                <div class="viva-card" id="viva-dynamic"><p class="panel-description">Loading measured highlights...</p></div>\n' + s[b:]
rep('<li><strong>Student USNs:</strong> <code>1MS22CS001, 1MS22CS002</code></li>',
    '<li><strong>Team ID and USNs:</strong> <span class="badge badge-classical">placeholder: fill in before submission</span> (first line of <code>evaluation/reports/eval_P3_&lt;TeamID&gt;.md</code>)</li>')
rep('(<code>/api/v1/generate</code>, <code>/api/v1/capabilities</code>, <code>/api/v1/model</code>)', '(<code>/api/v1/generate</code>, <code>/api/v1/capabilities</code>, <code>/api/v1/models</code>, <code>/api/v1/research/overview</code>)')
rep('<script src="/static/app.js?v=p3-sidebar-navigation-v6"></script>', '<script src="/static/app.js?v=p3-research-v7"></script>')
open(p, 'w', encoding='utf-8').write(s)

# ------------------------------------------------------------------ JS
p = 'backend/app/static/app.js'
s = open(p, encoding='utf-8').read()
a = s.index('function initFailureAnalysis() {')
b = s.index('\n}\n', a) + 3
new_js = r'''function initFailureAnalysis() {
  const container = document.getElementById('failure-container');
  const filters = document.getElementById('failure-filters');
  if (!container) return;
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  fetch('/api/v1/research/overview').then((r) => r.json()).then((o) => {
    const items = o.failures || [];
    const groups = { all: 'All', open: 'Open', measured: 'Measured', info: 'Stated' };
    const draw = (f) => {
      container.innerHTML = items.filter((x) => f === 'all' || x.severity === f).map((x) => `
        <details class="failure-item" open>
          <summary><strong>${esc(x.title)}</strong> <span class="badge ${x.severity === 'open' ? 'badge-classical' : 'badge-hybrid'}">${esc(x.status)}</span></summary>
          <div class="failure-body">
            <p><strong>Why:</strong> ${esc(x.cause)}</p>
            <p><strong>What we measured:</strong> ${esc(x.evidence)}</p>
            <p><strong>What we did:</strong> ${esc(x.mitigation)}</p>
          </div>
        </details>`).join('') || '<p class="panel-description">Nothing in this group.</p>';
    };
    filters.innerHTML = Object.entries(groups).map(([k, label]) => `<button class="pill-btn ${k === 'all' ? 'active' : ''}" data-filter="${k}">${label} (${k === 'all' ? items.length : items.filter((x) => x.severity === k).length})</button>`).join('');
    filters.querySelectorAll('.pill-btn').forEach((b) => b.addEventListener('click', () => {
      filters.querySelectorAll('.pill-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      draw(b.dataset.filter);
    }));
    draw('all');
  }).catch(() => { container.innerHTML = '<p class="panel-description">Could not load the measured failure analysis.</p>'; });
}

// Measured extras for the Comparison and About tabs (single source of truth: /api/v1/research/overview)
function loadResearchExtras() {
  const box = document.getElementById('research-extras');
  const viva = document.getElementById('viva-dynamic');
  if (!box && !viva) return;
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (x) => (x == null ? '-' : Math.round(100 * x) + '%');
  fetch('/api/v1/research/overview').then((r) => r.json()).then((o) => {
    if (viva) {
      viva.innerHTML = (o.headlines || []).map((h, i) => `<div class="viva-point"><strong>${i + 1}. ${esc(h.label)}: ${esc(h.value)}</strong><span>${esc(h.sub)}</span></div>`).join('')
        + `<div class="viva-point"><strong>${(o.headlines || []).length + 1}. Hybrid architecture, honestly:</strong><span>Generation runs on a GPU server and phone clients call the API. We did not run on a phone; mobile feasibility is analytical only.</span></div>`;
    }
    if (!box) return;
    let h = '';
    h += `<h3 class="sub-title" style="margin-top:18px">What we found</h3><ul class="about-list">${(o.insights || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
    if (o.prompt_accuracy) {
      const cats = ['single', 'two_objects', 'counting', 'colour', 'position'];
      h += `<h3 class="sub-title" style="margin-top:22px">Prompt accuracy (does the picture contain what was asked?)</h3><div class="table-container"><table class="data-table"><thead><tr><th>Model</th><th>One object</th><th>Two objects</th><th>Counting</th><th>Colours</th><th>Positions</th><th>Overall</th></tr></thead><tbody>`
        + o.prompt_accuracy.slice().sort((a, b) => b.overall - a.overall).map((r) => `<tr><td><strong>${esc(r.id)}</strong> ${esc(r.label)}</td>${cats.map((c) => `<td>${pct(r.per_category[c])}</td>`).join('')}<td><strong>${pct(r.overall)}</strong></td></tr>`).join('')
        + `</tbody></table></div>`;
    }
    if (o.best_of_n) {
      h += `<h3 class="sub-title" style="margin-top:22px">Best of N (SD-Turbo, ${esc(o.best_of_n.prompts)} prompts)</h3><p class="panel-description">${esc(o.best_of_n.note)}</p><div class="table-container"><table class="data-table"><thead><tr><th>N</th><th>Overall</th><th>Positions</th><th>Counting</th><th>Best possible</th><th>Time (laptop, est.)</th></tr></thead><tbody>`
        + o.best_of_n.rows.map((r) => `<tr><td>${r.n}</td><td><strong>${pct(r.overall)}</strong></td><td>${pct(r.per_category.position)}</td><td>${pct(r.per_category.counting)}</td><td>${pct(r.ceiling)}</td><td>${r.cost_ms_laptop_est ? (r.cost_ms_laptop_est / 1000).toFixed(1) + ' s' : '-'}</td></tr>`).join('')
        + `</tbody></table></div>`;
    }
    if (o.tiny_vae) {
      h += `<h3 class="sub-title" style="margin-top:22px">Tiny decoder on SD-Turbo (cloud GPU, compare rows with each other)</h3><div class="table-container"><table class="data-table"><thead><tr><th>Variant</th><th>Steps</th><th>Tiny decoder</th><th>FID</th><th>CLIP</th><th>Latency</th><th>Size</th></tr></thead><tbody>`
        + o.tiny_vae.map((r) => `<tr><td><strong>${esc(r.id)}</strong></td><td>${r.steps}</td><td>${r.tiny_vae ? 'yes' : 'no'}</td><td>${r.fid.toFixed(1)}</td><td>${r.clip.toFixed(3)}</td><td>${r.latency_ms.toFixed(0)} ms</td><td>${(r.size_mb / 1024).toFixed(2)} GB</td></tr>`).join('')
        + `</tbody></table></div>`;
    }
    h += `<p class="panel-description" style="margin-top:18px">${esc((o.protocol || {}).caveat)} See the full results on the <a href="/research" style="color:var(--accent-indigo)">Research results</a> page.</p>`;
    box.innerHTML = h;
  }).catch(() => { if (box) box.innerHTML = '<p class="panel-description">Could not load the measured results.</p>'; });
}
'''
s = s[:a] + new_js + s[b:]
s = s.replace('  loadMeasuredBenchmark();\n  initGenerateTab();', '  loadMeasuredBenchmark();\n  loadResearchExtras();\n  initGenerateTab();', 1)
assert 'loadResearchExtras();\n  initGenerateTab' in s
open(p, 'w', encoding='utf-8').write(s)
print('ok')
