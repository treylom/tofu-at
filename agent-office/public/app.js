// === Agent Office v3.3 — Mission Control + Node Graph + Pixel Office + Interactive ===

// --- State ---
let bulletinData = [];
let lastKmWorkflow = null;
let currentMode = 'dashboard'; // 'dashboard' | 'pixel' | 'results'

// --- Theme Selector (Classic / Tofu) ---
function setTheme(themeName) {
  const html = document.documentElement;
  if (themeName === 'tofu') {
    html.classList.add('theme-tofu');
  } else {
    html.classList.remove('theme-tofu');
  }
  localStorage.setItem('agent-office-theme', themeName);
  // Update button active states
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === themeName);
  });
  if (lastKmWorkflow) renderNodeGraph(lastKmWorkflow);
}
(function initTheme() {
  const saved = localStorage.getItem('agent-office-theme');
  if (saved === 'tofu') {
    document.documentElement.classList.add('theme-tofu');
  }
  // Set active button on load
  document.addEventListener('DOMContentLoaded', () => {
    const active = saved || 'classic';
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === active);
    });
  });
})();

// === Agent Icon Generation ===

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const ICON_COLORS = ['#22d3ee','#34d399','#a78bfa','#fbbf24','#f472b6','#60a5fa','#f97316','#e879f9'];

function generateAgentIcon(name, size) {
  size = size || 30;
  const hash = simpleHash(name || 'agent');
  const color = ICON_COLORS[hash % ICON_COLORS.length];
  const shapeIdx = (hash >> 3) % 4;
  const initials = (name || 'AG').slice(0, 2).toUpperCase();
  const half = size / 2;
  const fontSize = Math.round(size * 0.37);

  let shapeSvg = '';
  if (shapeIdx === 0) {
    shapeSvg = `<circle cx="${half}" cy="${half}" r="${half - 2}" fill="${color}" fill-opacity="${document.documentElement.classList.contains('theme-tofu') ? 0.35 : 0.2}" stroke="${color}" stroke-width="1.5"/>`;
  } else if (shapeIdx === 1) {
    shapeSvg = `<polygon points="${half},2 ${size - 2},${half} ${half},${size - 2} 2,${half}" fill="${color}" fill-opacity="${document.documentElement.classList.contains('theme-tofu') ? 0.35 : 0.2}" stroke="${color}" stroke-width="1.5"/>`;
  } else if (shapeIdx === 2) {
    const r = half - 2;
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i - Math.PI / 2;
      pts.push(`${half + r * Math.cos(a)},${half + r * Math.sin(a)}`);
    }
    shapeSvg = `<polygon points="${pts.join(' ')}" fill="${color}" fill-opacity="${document.documentElement.classList.contains('theme-tofu') ? 0.35 : 0.2}" stroke="${color}" stroke-width="1.5"/>`;
  } else {
    shapeSvg = `<rect x="2" y="2" width="${size - 4}" height="${size - 4}" rx="4" fill="${color}" fill-opacity="${document.documentElement.classList.contains('theme-tofu') ? 0.35 : 0.2}" stroke="${color}" stroke-width="1.5"/>`;
  }

  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${shapeSvg}<text x="${half}" y="${half + fontSize * 0.35}" text-anchor="middle" fill="${color}" font-size="${fontSize}" font-weight="700" font-family="'Noto Sans KR', monospace">${initials}</text></svg>`;
}

function generateAgentIconSVGElements(name, x, y, size) {
  size = size || 28;
  const hash = simpleHash(name || 'agent');
  const color = ICON_COLORS[hash % ICON_COLORS.length];
  const shapeIdx = (hash >> 3) % 4;
  const initials = (name || 'AG').slice(0, 2).toUpperCase();
  const cx = x + size / 2;
  const cy = y + size / 2;
  const fontSize = Math.round(size * 0.37);

  let shape = '';
  if (shapeIdx === 0) {
    shape = `<circle cx="${cx}" cy="${cy}" r="${size / 2 - 2}" fill="${color}" fill-opacity="${document.documentElement.classList.contains('theme-tofu') ? 0.35 : 0.2}" stroke="${color}" stroke-width="1.5"/>`;
  } else if (shapeIdx === 1) {
    const h = size / 2;
    shape = `<polygon points="${cx},${y + 2} ${x + size - 2},${cy} ${cx},${y + size - 2} ${x + 2},${cy}" fill="${color}" fill-opacity="${document.documentElement.classList.contains('theme-tofu') ? 0.35 : 0.2}" stroke="${color}" stroke-width="1.5"/>`;
  } else if (shapeIdx === 2) {
    const r = size / 2 - 2;
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i - Math.PI / 2;
      pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
    }
    shape = `<polygon points="${pts.join(' ')}" fill="${color}" fill-opacity="${document.documentElement.classList.contains('theme-tofu') ? 0.35 : 0.2}" stroke="${color}" stroke-width="1.5"/>`;
  } else {
    shape = `<rect x="${x + 2}" y="${y + 2}" width="${size - 4}" height="${size - 4}" rx="4" fill="${color}" fill-opacity="${document.documentElement.classList.contains('theme-tofu') ? 0.35 : 0.2}" stroke="${color}" stroke-width="1.5"/>`;
  }

  const text = `<text x="${cx}" y="${cy + fontSize * 0.35}" text-anchor="middle" fill="${color}" font-size="${fontSize}" font-weight="700" font-family="'Noto Sans KR', monospace">${initials}</text>`;
  return shape + text;
}

// === Node Graph (n8n-style Agent Flow) ===

function buildAgentGraph(km) {
  const nodes = {};
  const edges = [];
  const plan = km.plan;
  const progress = km.progress;

  // Native-only fallback: no steps but team exists → auto-generate star topology
  if (!plan || (!plan.steps?.length && !plan.team?.length)) return { nodes: [], edges: [] };

  if (!plan.steps || !plan.steps.length) {
    // Build star topology from team members
    let leadName = null;
    for (const member of (plan.team || [])) {
      const name = (member.name || '').replace(/^@/, '');
      if (!name) continue;
      const rl = (member.role || '').toLowerCase();
      const nameLC = name.toLowerCase();
      const isCategoryLead = rl.includes('category') || rl.includes('cat.') || rl.includes('카테고리')
        || nameLC.includes('-intel-lead') || nameLC.includes('-proc-lead');
      const isDA = rl.includes('devil') || rl.includes('advocate') || rl.includes('반론')
        || nameLC.includes('devil') || nameLC.includes('advocate');
      const nodeType = isDA ? 'da'
        : isCategoryLead ? 'category_lead'
        : (rl.includes('lead') || rl.includes('main') || rl.includes('총괄')) ? 'lead' : 'worker';
      nodes[name] = { name, role: member.role || '', model: member.model || '', status: 'pending', tasks: [], progress: 0, task: '', nodeType };
      // Match progress data
      const agentProg = (progress?.agents || []).find(a => (a.agent || '').replace(/^@/, '') === name);
      if (agentProg) {
        nodes[name].progress = agentProg.progress || 0;
        nodes[name].task = agentProg.task || '';
        nodes[name].status = agentProg.progress >= 100 ? 'done' : agentProg.progress > 0 ? 'active' : 'pending';
      }
      // Detect lead
      if (!leadName && nodeType === 'lead') {
        leadName = name;
      }
    }
    // If no explicit lead found, pick first member
    if (!leadName && Object.keys(nodes).length > 0) leadName = Object.keys(nodes)[0];

    // Check for category leads
    const categoryLeads = Object.values(nodes).filter(n => n.nodeType === 'category_lead');

    if (leadName) {
      // Universal left-to-right flow: Workers → [CatLeads →] DA → Lead
      const daNodes = Object.entries(nodes).filter(([, n]) => n.nodeType === 'da');
      const catLeadNodes = Object.entries(nodes).filter(([, n]) => n.nodeType === 'category_lead');
      const workerNodes = Object.entries(nodes).filter(([name, n]) =>
        name !== leadName && n.nodeType === 'worker');

      // Track connected workers
      const connected = new Set();

      // If hierarchy data exists, use it for category lead → worker mapping
      const hierarchy = plan.hierarchy || [];
      for (const [clName, clNode] of catLeadNodes) {
        const hierEntry = hierarchy.find(h => (h.parent || '').replace(/^@/, '') === clName);
        if (hierEntry && hierEntry.children) {
          const children = hierEntry.children.split(',').map(c => c.trim().replace(/^@/, ''));
          for (const child of children) {
            if (nodes[child] && nodes[child].nodeType === 'worker') {
              edges.push({ from: child, to: clName, type: 'dependency', active: nodes[child].progress > 0 && nodes[child].progress < 100 });
              connected.add(child);
            }
          }
        }
        // CatLead → DA or Lead
        if (daNodes.length > 0) {
          edges.push({ from: clName, to: daNodes[0][0], type: 'dependency', active: clNode.progress > 0 && clNode.progress < 100 });
        } else {
          edges.push({ from: clName, to: leadName, type: 'dependency', active: clNode.progress > 0 && clNode.progress < 100 });
        }
      }

      // Workers not connected by hierarchy → connect to nearest cat lead or DA or lead
      for (const [wName, wNode] of workerNodes) {
        if (connected.has(wName)) continue;
        const isActive = wNode.progress > 0 && wNode.progress < 100;
        if (catLeadNodes.length > 0) {
          // Connect to first category lead (fallback)
          edges.push({ from: wName, to: catLeadNodes[0][0], type: 'dependency', active: !!isActive });
        } else if (daNodes.length > 0) {
          edges.push({ from: wName, to: daNodes[0][0], type: 'dependency', active: !!isActive });
        } else {
          edges.push({ from: wName, to: leadName, type: 'dependency', active: !!isActive });
        }
        connected.add(wName);
      }

      // DA → Lead
      for (const [daName, daNode] of daNodes) {
        edges.push({ from: daName, to: leadName, type: 'dependency', active: daNode.progress > 0 && daNode.progress < 100 });
      }

      // If no DA and no cat leads: already handled above (workers → lead)
    }
    return { nodes: Object.values(nodes), edges };
  }

  // Phase 1: Build nodes from steps
  for (const step of plan.steps) {
    const assignee = (step.assignee || '').trim();
    if (!assignee) continue;

    if (!nodes[assignee]) {
      nodes[assignee] = { name: assignee, role: '', model: '', status: 'pending', tasks: [], progress: 0, task: '', nodeType: 'worker' };
    }
    nodes[assignee].tasks.push(step.step || step.id || '');

    // Match team member info
    const member = (plan.team || []).find(t => t.name === assignee);
    if (member) {
      nodes[assignee].role = member.role || '';
      nodes[assignee].model = member.model || '';
      const rl = (member.role || '').toLowerCase();
      const assigneeLC = assignee.toLowerCase();
      const isCatLead = rl.includes('category') || rl.includes('cat.') || rl.includes('카테고리')
        || assigneeLC.includes('-intel-lead') || assigneeLC.includes('-proc-lead');
      if (rl.includes('devil') || rl.includes('advocate') || rl.includes('반론')
          || assigneeLC.includes('devil') || assigneeLC.includes('advocate')) nodes[assignee].nodeType = 'da';
      else if (isCatLead) nodes[assignee].nodeType = 'category_lead';
      else if (rl.includes('lead') || rl.includes('main') || rl.includes('총괄')) nodes[assignee].nodeType = 'lead';
    }

    // Match progress (normalize @prefix — progress uses @name, plan uses name)
    const cleanAssignee = assignee.replace(/^@/, '');
    const agentProg = (progress?.agents || []).find(a =>
      (a.agent || '').replace(/^@/, '') === cleanAssignee
    );
    if (agentProg) {
      nodes[assignee].progress = agentProg.progress || 0;
      nodes[assignee].task = agentProg.task || '';
      nodes[assignee].status = agentProg.progress >= 100 ? 'done' : agentProg.progress > 0 ? 'active' : 'pending';
    }

    // Build dependency edges
    if (step.dependency) {
      const deps = step.dependency.split(',').map(d => d.trim());
      for (const dep of deps) {
        const depNum = dep.replace(/\D/g, '');
        if (!depNum) continue;
        const depStep = plan.steps.find(s => {
          const sId = (s.id || '').replace(/\D/g, '');
          return sId === depNum;
        });
        if (depStep) {
          const depAssignee = (depStep.assignee || '').trim();
          if (depAssignee && depAssignee !== assignee) {
            // Edge active: based on target node's real-time progress (step.status is often empty)
            const targetNode = nodes[assignee];
            const isActive = targetNode && targetNode.progress > 0 && targetNode.progress < 100;
            edges.push({ from: depAssignee, to: assignee, type: 'dependency', active: !!isActive });
          }
        }
      }
    }
  }

  // Phase 1.5: Add team members not in steps (DA, Lead, support roles)
  for (const member of (plan.team || [])) {
    const memberName = (member.name || '').replace(/^@/, '');
    if (!memberName || nodes[memberName]) continue;

    const rl = (member.role || '').toLowerCase();
    const memberNameLC = memberName.toLowerCase();
    const isDA = rl.includes('devil') || rl.includes('advocate') || rl.includes('반론')
      || memberNameLC.includes('devil') || memberNameLC.includes('advocate');
    const isCatLead = rl.includes('category') || rl.includes('cat.') || rl.includes('카테고리')
      || memberNameLC.includes('-intel-lead') || memberNameLC.includes('-proc-lead');
    const isLead = !isCatLead && (rl.includes('lead') || rl.includes('main') || rl.includes('총괄'));
    const nodeType = isDA ? 'da' : isCatLead ? 'category_lead' : isLead ? 'lead' : 'support';

    nodes[memberName] = {
      name: memberName, role: member.role || '', model: member.model || '',
      status: 'pending', tasks: [], progress: 0, task: '', nodeType,
    };

    // Match progress data
    const agentProg = (progress?.agents || []).find(a =>
      (a.agent || '').replace(/^@/, '') === memberName);
    if (agentProg) {
      nodes[memberName].progress = agentProg.progress || 0;
      nodes[memberName].task = agentProg.task || '';
      nodes[memberName].status = agentProg.progress >= 100 ? 'done' : agentProg.progress > 0 ? 'active' : 'pending';
    }

    // Connect to graph: DA/Lead → find existing lead or first worker
    const leadNode = Object.values(nodes).find(n => n.nodeType === 'lead' && n.name !== memberName);
    if (isDA && leadNode) {
      edges.push({ from: leadNode.name, to: memberName, type: 'dependency', active: nodes[memberName].progress > 0 && nodes[memberName].progress < 100 });
    } else if (isLead) {
      for (const [name, node] of Object.entries(nodes)) {
        if (name !== memberName && node.nodeType !== 'lead' && node.nodeType !== 'da') {
          edges.push({ from: memberName, to: name, type: 'dependency', active: node.progress > 0 && node.progress < 100 });
        }
      }
    }
  }

  // Phase 2: Bulletin communication edges
  const bulletinEntries = km.bulletin?.entries || [];
  for (const entry of bulletinEntries.slice(0, 20)) {
    const target = extractTargetAgent(entry);
    if (target && entry.agent && target !== entry.agent && nodes[entry.agent] && nodes[target]) {
      edges.push({ from: entry.agent, to: target, type: 'message', active: true });
    }
  }

  // Deduplicate edges
  const edgeKeys = new Set();
  const uniqueEdges = [];
  for (const e of edges) {
    const key = `${e.from}|${e.to}|${e.type}`;
    if (!edgeKeys.has(key)) {
      edgeKeys.add(key);
      uniqueEdges.push(e);
    }
  }

  return { nodes: Object.values(nodes), edges: uniqueEdges };
}

function renderNodeGraph(km) {
  const svgEl = document.getElementById('agent-graph-svg');
  const graphContainer = document.getElementById('mc-graph');
  const edgeCountEl = document.getElementById('mc-edge-count');
  if (!svgEl || !graphContainer) return;

  const graph = buildAgentGraph(km);

  if (!graph.nodes.length) {
    graphContainer.className = 'mc-graph empty';
    svgEl.innerHTML = '';
    if (edgeCountEl) edgeCountEl.textContent = '0';
    return;
  }

  graphContainer.className = 'mc-graph';
  if (edgeCountEl) edgeCountEl.textContent = graph.edges.length;

  // Layout: Left-to-right layers
  const NODE_W = 220;
  const NODE_H = 105;
  const NODE_GAP = 110;
  const PAD_X = 30;
  const PAD_Y = 20;
  // LAYER_GAP is computed dynamically after layer grouping below

  // Compute layers (topological sort)
  const incomingDeps = {};
  const layerMap = {};
  for (const n of graph.nodes) { incomingDeps[n.name] = new Set(); layerMap[n.name] = 0; }
  for (const e of graph.edges) {
    if (e.type === 'dependency' && incomingDeps[e.to]) {
      incomingDeps[e.to].add(e.from);
    }
  }

  // Iterative layer assignment
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 20) {
    changed = false;
    iterations++;
    for (const e of graph.edges) {
      if (e.type === 'dependency' && layerMap[e.from] !== undefined && layerMap[e.to] !== undefined) {
        const newLayer = layerMap[e.from] + 1;
        if (newLayer > layerMap[e.to]) {
          layerMap[e.to] = newLayer;
          changed = true;
        }
      }
    }
  }

  // Reposition Lead to last layer, DA to second-to-last
  // This reflects the actual workflow: Workers → DA review → Lead aggregation
  let maxLayer = 0;
  for (const n of graph.nodes) { if (layerMap[n.name] > maxLayer) maxLayer = layerMap[n.name]; }
  for (const n of graph.nodes) {
    if (n.nodeType === 'lead') layerMap[n.name] = maxLayer + 2;
    else if (n.nodeType === 'da') layerMap[n.name] = maxLayer + 1;
  }

  // Group nodes by layer
  const layers = {};
  for (const n of graph.nodes) {
    const l = layerMap[n.name] || 0;
    if (!layers[l]) layers[l] = [];
    layers[l].push(n);
  }

  // Assign coordinates
  const nodePos = {};
  const layerKeys = Object.keys(layers).map(Number).sort((a, b) => a - b);

  // Fixed LAYER_GAP for uniform spacing (horizontal scroll via overflow-x: auto)
  const LAYER_GAP = 260;

  let maxY = 0;

  for (let idx = 0; idx < layerKeys.length; idx++) {
    const lk = layerKeys[idx];
    const nodesInLayer = layers[lk];
    for (let i = 0; i < nodesInLayer.length; i++) {
      const x = PAD_X + idx * LAYER_GAP;
      const y = PAD_Y + i * NODE_GAP;
      nodePos[nodesInLayer[i].name] = { x, y };
      if (y + NODE_H > maxY) maxY = y + NODE_H;
    }
  }

  const svgWidth = PAD_X * 2 + Math.max(layerKeys.length - 1, 0) * LAYER_GAP + NODE_W;
  const svgHeight = maxY + PAD_Y + 30; // extra space for phase labels
  svgEl.setAttribute('width', svgWidth);
  svgEl.setAttribute('height', Math.max(svgHeight, 160));

  let svgContent = '';

  // Phase background boxes (from workflowPhases data)
  const workflowPhases = km.plan?.workflowPhases || [];
  if (workflowPhases.length > 0 && layerKeys.length > 0) {
    const borderVar = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#1e2a3a';
    const bgSecVar = getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim() || '#0f1419';
    const textMutedVar = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#6b7a8a';
    for (let pi = 0; pi < Math.min(workflowPhases.length, layerKeys.length); pi++) {
      const phase = workflowPhases[pi];
      const lk = layerKeys[pi];
      const nodesInLayer = layers[lk] || [];
      if (!nodesInLayer.length) continue;
      const px = PAD_X + pi * LAYER_GAP - 12;
      const py = 4;
      const pw = NODE_W + 24;
      const ph = Math.max(nodesInLayer.length * NODE_GAP + 16, NODE_H + 28);
      svgContent += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="10" fill="${bgSecVar}" stroke="${borderVar}" stroke-width="1" opacity="0.6"/>`;
      svgContent += `<text x="${px + pw / 2}" y="${py + 14}" text-anchor="middle" fill="${textMutedVar}" font-size="10" font-weight="600" font-family="var(--font-mono, monospace)" letter-spacing="0.05em">${escHtml(phase.phase || 'Phase ' + (pi + 1))}</text>`;
    }
  }

  // Auto-generated layer group boxes (when no explicit workflowPhases)
  if (workflowPhases.length === 0 && layerKeys.length > 1) {
    const isTofu = document.documentElement.classList.contains('theme-tofu');
    const borderVar = isTofu ? '#c4a882' : (getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#1e2a3a');
    const bgFill = isTofu ? '#f0e6d6' : (getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim() || '#0f1419');
    const textFill = isTofu ? '#8b6914' : (getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#6b7a8a');
    const boxOpacity = isTofu ? '0.85' : '0.4';
    const textOpacity = isTofu ? '1' : '0.7';
    for (let idx = 0; idx < layerKeys.length; idx++) {
      const lk = layerKeys[idx];
      const nodesInLayer = layers[lk] || [];
      if (nodesInLayer.length < 2) continue; // Only group layers with 2+ nodes
      const px = PAD_X + idx * LAYER_GAP - 12;
      const py = 4;
      const pw = NODE_W + 24;
      const ph = Math.max(nodesInLayer.length * NODE_GAP + 16, NODE_H + 28);
      // Determine group label from node types
      const hasWorkers = nodesInLayer.some(n => n.nodeType === 'worker');
      const hasCatLead = nodesInLayer.some(n => n.nodeType === 'category_lead');
      const label = hasCatLead ? 'Category Leads' : hasWorkers ? 'Workers' : `Layer ${idx + 1}`;
      svgContent += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="10" fill="${bgFill}" stroke="${borderVar}" stroke-width="${isTofu ? '1.5' : '1'}" opacity="${boxOpacity}"/>`;
      svgContent += `<text x="${px + pw / 2}" y="${py + 14}" text-anchor="middle" fill="${textFill}" font-size="10" font-weight="700" font-family="var(--font-mono, monospace)" letter-spacing="0.05em" opacity="${textOpacity}">${label}</text>`;
    }
  }

  // Arrowhead marker defs
  svgContent += `<defs>
    <marker id="arrow-default" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
      <polygon points="0 0, 10 4, 0 8" fill="#6b7a8a"/>
    </marker>
    <marker id="arrow-active" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
      <polygon points="0 0, 10 4, 0 8" fill="#22c55e"/>
    </marker>
    <marker id="arrow-message" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
      <polygon points="0 0, 10 4, 0 8" fill="#34d399"/>
    </marker>
    <filter id="glow-active" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="glow-message" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;

  // Render edges (behind nodes)
  for (const edge of graph.edges) {
    const fromPos = nodePos[edge.from];
    const toPos = nodePos[edge.to];
    if (!fromPos || !toPos) continue;

    const x1 = fromPos.x + NODE_W;
    const y1 = fromPos.y + NODE_H / 2;
    const x2 = toPos.x;
    const y2 = toPos.y + NODE_H / 2;
    const cpx = (x1 + x2) / 2;

    const isMsg = edge.type === 'message';
    const isActive = edge.active;
    const strokeColor = isMsg ? '#34d399' : isActive ? '#22c55e' : '#4a5568';
    const strokeWidth = isActive ? 2.5 : 2;
    const opacity = isActive ? 1 : 0.5;
    const dashArray = isMsg ? 'stroke-dasharray="6 3"' : '';
    const marker = isMsg ? 'arrow-message' : isActive ? 'arrow-active' : 'arrow-default';
    const glowFilter = isActive ? ` filter="url(#edge-glow-${isMsg ? 'msg' : 'dep'})"` : '';
    const animClass = isActive ? ' class="edge-animated"' : '';

    svgContent += `<path d="M${x1},${y1} C${cpx},${y1} ${cpx},${y2} ${x2},${y2}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" opacity="${opacity}" ${dashArray} marker-end="url(#${marker})"${animClass}${glowFilter}/>`;

    // Glow effect + flowing dot for active edges
    if (isActive) {
      svgContent += `<path d="M${x1},${y1} C${cpx},${y1} ${cpx},${y2} ${x2},${y2}" fill="none" stroke="${strokeColor}" stroke-width="5" opacity="0.15" ${dashArray}>
        <animate attributeName="opacity" values="0.08;0.3;0.08" dur="2s" repeatCount="indefinite"/>
      </path>`;
      // Flowing dot along edge
      const pathId = `edge-path-${edge.from}-${edge.to}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      svgContent += `<path id="${pathId}" d="M${x1},${y1} C${cpx},${y1} ${cpx},${y2} ${x2},${y2}" fill="none" stroke="none"/>`;
      svgContent += `<circle r="3.5" fill="${strokeColor}" opacity="0.9">
        <animateMotion dur="${isMsg ? '1.5s' : '2s'}" repeatCount="indefinite">
          <mpath href="#${pathId}"/>
        </animateMotion>
      </circle>`;
    }
  }

  // Render nodes
  for (const node of graph.nodes) {
    const pos = nodePos[node.name];
    if (!pos) continue;

    const isActive = node.status === 'active';
    const isDone = node.status === 'done';
    const isDA = node.nodeType === 'da';
    const isLeadNode = node.nodeType === 'lead';
    const isCatLead = node.nodeType === 'category_lead';
    const strokeColor = isDA ? '#a78bfa' : isLeadNode ? '#fbbf24' : isCatLead ? '#f97316' : isActive ? '#22c55e' : isDone ? '#3b82f6' : '#fbbf24';
    const strokeWidth = isLeadNode ? 3 : isCatLead ? 2.5 : isActive ? 2.5 : 2;
    const dashArray = isDA ? ' stroke-dasharray="5 3"' : '';

    // Node group
    svgContent += `<g>`;

    // Active node glow (3-layer: outer + middle + inner)
    if (isActive) {
      // Outer: wide soft pulse (green = working)
      svgContent += `<rect x="${pos.x - 4}" y="${pos.y - 4}" width="${NODE_W + 8}" height="${NODE_H + 8}" rx="11" fill="none" stroke="#22c55e" stroke-width="1.5" opacity="0.15">
        <animate attributeName="opacity" values="0.05;0.25;0.05" dur="3s" repeatCount="indefinite"/>
        <animate attributeName="stroke-width" values="1;2.5;1" dur="3s" repeatCount="indefinite"/>
      </rect>`;
      // Middle: medium brightness
      svgContent += `<rect x="${pos.x - 1}" y="${pos.y - 1}" width="${NODE_W + 2}" height="${NODE_H + 2}" rx="9" fill="none" stroke="#22c55e" stroke-width="2" opacity="0.3">
        <animate attributeName="opacity" values="0.15;0.5;0.15" dur="2s" repeatCount="indefinite"/>
      </rect>`;
      // Inner: sharp border
      svgContent += `<rect x="${pos.x}" y="${pos.y}" width="${NODE_W}" height="${NODE_H}" rx="8" fill="none" stroke="#22c55e" stroke-width="2" opacity="0.5">
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1.5s" repeatCount="indefinite"/>
      </rect>`;
    }

    // Done node subtle glow (blue = done)
    if (isDone) {
      svgContent += `<rect x="${pos.x}" y="${pos.y}" width="${NODE_W}" height="${NODE_H}" rx="8" fill="none" stroke="#3b82f6" stroke-width="1" opacity="0.25"/>`;
    }

    // Node background (uses CSS variable for theme support)
    const bgCard = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim() || '#141a22';
    svgContent += `<rect class="graph-node-rect" x="${pos.x}" y="${pos.y}" width="${NODE_W}" height="${NODE_H}" rx="8" fill="${bgCard}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${dashArray}/>`;

    // Role badge (top-right corner, rendered first so name doesn't overlap)
    if (isDA) {
      svgContent += `<text x="${pos.x + NODE_W - 8}" y="${pos.y + 14}" text-anchor="end" fill="#a78bfa" font-size="9" font-weight="700" font-family="'JetBrains Mono', 'Noto Sans KR', monospace">DA</text>`;
    } else if (isLeadNode) {
      svgContent += `<text x="${pos.x + NODE_W - 8}" y="${pos.y + 14}" text-anchor="end" fill="#fbbf24" font-size="9" font-weight="700" font-family="'JetBrains Mono', 'Noto Sans KR', monospace">LEAD</text>`;
    } else if (isCatLead) {
      svgContent += `<text x="${pos.x + NODE_W - 8}" y="${pos.y + 14}" text-anchor="end" fill="#f97316" font-size="9" font-weight="700" font-family="'JetBrains Mono', 'Noto Sans KR', monospace">CAT.LEAD</text>`;
    }

    // Agent icon (left side, shifted down to avoid badge overlap)
    svgContent += generateAgentIconSVGElements(node.name, pos.x + 8, pos.y + 16, 24);

    // Name text (below badge row)
    const displayName = node.name.length > 18 ? node.name.slice(0, 17) + '\u2026' : node.name;
    svgContent += `<text class="graph-node-text" x="${pos.x + 38}" y="${pos.y + 30}">${escHtml(displayName)}</text>`;

    // Model text
    if (node.model) {
      svgContent += `<text class="graph-node-model" x="${pos.x + 38}" y="${pos.y + 42}">${escHtml(node.model)}</text>`;
    }

    // Task text (truncated) — enhanced with status-aware coloring
    const taskText = (node.task || node.tasks[0] || 'Waiting...').slice(0, 25);
    const textPrimary = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#e2e8f0';
    const textSecondary = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#94a3b8';
    const taskColor = isActive ? textPrimary : isDone ? '#93c5fd' : textSecondary;
    svgContent += `<text x="${pos.x + 8}" y="${pos.y + 56}" fill="${taskColor}" font-size="11" font-weight="${isActive ? '600' : '400'}" font-family="'Inter', 'Noto Sans KR', sans-serif">${escHtml(taskText)}</text>`;
    if (isActive && node.task) {
      svgContent += `<text x="${pos.x + 8}" y="${pos.y + 68}" fill="#94a3b8" font-size="10" font-family="'Inter', 'Noto Sans KR', sans-serif">In progress...</text>`;
    }

    // Progress bar
    const pct = node.progress || 0;
    const barW = NODE_W - 16;
    const fillColor = isDone ? '#3b82f6' : isActive ? '#22c55e' : '#fbbf24';
    svgContent += `<rect x="${pos.x + 8}" y="${pos.y + NODE_H - 14}" width="${barW}" height="4" rx="2" fill="var(--border, #1e2a3a)"/>`;
    svgContent += `<rect x="${pos.x + 8}" y="${pos.y + NODE_H - 14}" width="${barW * pct / 100}" height="4" rx="2" fill="${fillColor}"/>`;

    // Status text (right-aligned) — uses 3-state label
    const pctText = getProgressLabel(pct, node);
    const pctColor = isDone ? '#3b82f6' : isActive ? '#22c55e' : '#fbbf24';
    svgContent += `<text x="${pos.x + NODE_W - 8}" y="${pos.y + NODE_H - 18}" text-anchor="end" fill="${pctColor}" font-size="11" font-weight="700" font-family="'JetBrains Mono', 'Noto Sans KR', monospace">${pctText}</text>`;

    // Oversight label for DA and Lead (indicates they interact with all phases)
    if (isDA) {
      svgContent += `<text x="${pos.x + NODE_W / 2}" y="${pos.y + NODE_H + 14}" text-anchor="middle" fill="#a78bfa" font-size="9" font-weight="500" font-family="var(--font-mono, monospace)" opacity="0.7">\u2190 reviews all phases \u2192</text>`;
    } else if (isLeadNode) {
      svgContent += `<text x="${pos.x + NODE_W / 2}" y="${pos.y + NODE_H + 14}" text-anchor="middle" fill="#fbbf24" font-size="9" font-weight="500" font-family="var(--font-mono, monospace)" opacity="0.7">\u2190 oversees all phases \u2192</text>`;
    }

    svgContent += `</g>`;
  }

  svgEl.innerHTML = svgContent;
}

// --- Main Fetch ---
async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    render(data);
  } catch (e) {
    console.error('Failed to fetch status:', e);
  }
}

function render(data) {
  const km = data.kmWorkflow;
  const isEmpty = !km || (!km.plan && !km.progress && !km.bulletin && !km.findings);
  if (isEmpty) {
    lastKmWorkflow = null;
    bulletinData = [];
  } else {
    lastKmWorkflow = km;
  }

  // Mission Control (top)
  renderMissionControl(km);

  // Pixel Office mode update
  if (currentMode === 'pixel' && typeof PixelOffice !== 'undefined') {
    PixelOffice.updateAgents(km);
    renderPixelWorkflowBar(km);
  }

  // Inventory Grid (bottom)
  renderList('agents', data.agents, item => item.name);
  renderList('skills', data.skills, item => item.name);
  renderList('commands', data.commands, item => item.name);
  renderMCP(data.mcpServers);
  renderHooks(data.settings.hooks);
  renderPermissions(data.settings.permissions);
  renderPlugins(data.settings.plugins);
  renderTeamOS(data.teamOS);
  renderMetrics();
  renderRalphReviews(km);
  document.getElementById('timestamp').textContent = new Date(data.timestamp).toLocaleString();
}

// === Mission Control ===

function renderMissionControl(km) {
  km = km || {};
  renderLiveTeamBanner(km);
  renderTeamPlan(km);
  renderLiveAgents(km);
  renderNodeGraph(km);
  renderSprintSteps(km);
  renderCheckpoints(km);
  renderBulletin(km);
}

function renderLiveTeamBanner(km) {
  const el = document.getElementById('mc-team-banner');
  if (!el) return;
  const lt = km.liveTeam;
  if (!lt || !lt.name) { el.innerHTML = ''; return; }
  const platformBadge = lt.platform === 'wsl' ? 'WSL' : lt.platform === 'windows' ? 'Win' : lt.platform || '';
  el.innerHTML = `<span class="team-banner-name">${escHtml(lt.name)}</span>
    <span class="team-banner-badge">${platformBadge}</span>
    <span class="team-banner-stats">${lt.activeMembers || 0}/${lt.memberCount || 0} active</span>
    <span class="team-banner-msgs">${lt.totalMessages || 0} msgs</span>`;
}

function renderTeamPlan(km) {
  const container = document.getElementById('mc-plan');
  const statusEl = document.getElementById('mc-plan-status');
  if (!container || !statusEl) return;

  const plan = km.plan;
  const hasTeam = plan?.team?.length > 0;
  const hasSteps = plan?.steps?.length > 0;

  if (!plan || (!plan.subject && !hasTeam && !hasSteps)) {
    container.className = 'mc-plan empty';
    container.innerHTML = '';
    statusEl.textContent = '-';
    return;
  }

  container.className = 'mc-plan';

  // Determine plan status from agents progress
  const agents = km.progress?.agents || [];
  const allDone = agents.length > 0 && agents.every(a => a.progress >= 100);
  const anyActive = agents.some(a => a.progress > 0 && a.progress < 100);
  const planStatus = allDone ? 'Complete' : anyActive ? 'Active' : 'Pending';
  statusEl.textContent = planStatus;

  let html = '';

  // Subject
  if (plan.subject) {
    html += `<div class="mc-plan-subject">${escHtml(plan.subject)}</div>`;
  }

  // Complexity badge
  if (plan.complexity) {
    const cxClass = plan.complexity.toLowerCase().includes('dynamic') ? 'dynamic'
      : plan.complexity.toLowerCase().includes('complex') ? 'complex' : 'standard';
    html += `<div class="mc-plan-complexity ${cxClass}">${escHtml(plan.complexity)}</div>`;
  }

  // Team roles grid
  if (hasTeam) {
    html += '<div class="mc-plan-team">';
    html += '<div class="mc-plan-team-header">Name</div>';
    html += '<div class="mc-plan-team-header">Role</div>';
    html += '<div class="mc-plan-team-header">Model</div>';
    html += '<div class="mc-plan-team-header">St.</div>';

    for (const member of plan.team) {
      // Match with progress agents to get live status (normalize @prefix)
      const cleanMemberName = (member.name || '').replace(/^@/, '');
      const agentProgress = agents.find(a => (a.agent || '').replace(/^@/, '') === cleanMemberName);
      let statusIcon = '\u25CB'; // ○ pending
      if (agentProgress) {
        if (agentProgress.progress >= 100) statusIcon = '\u2713'; // ✓ done
        else if (agentProgress.progress > 0) statusIcon = '\u25D0'; // ◐ in-progress
      } else if (member.status === 'done' || member.status === 'completed') {
        statusIcon = '\u2713';
      }

      html += `<div class="mc-plan-team-cell name">${escHtml(member.name)}</div>`;
      html += `<div class="mc-plan-team-cell role">${escHtml(member.role || '')}</div>`;
      html += `<div class="mc-plan-team-cell model">${escHtml(member.model || '')}</div>`;
      html += `<div class="mc-plan-team-cell status">${statusIcon}</div>`;
    }
    html += '</div>';
  }

  // Steps pipeline
  if (hasSteps) {
    html += '<div class="mc-plan-steps">';
    html += '<span class="mc-plan-steps-label">Steps</span>';
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const isDone = step.status === 'done' || step.status === 'completed';
      const isActive = step.status === 'in-progress' || step.status === 'active';
      const cls = isDone ? 'done' : isActive ? 'in-progress' : 'pending';
      const icon = isDone ? '\u2713' : isActive ? '\u25D0' : '\u25CB';

      if (i > 0) html += '<span class="plan-step-arrow">\u2192</span>';
      html += `<span class="plan-step ${cls}">${icon} ${escHtml(step.step || step.id || '')}</span>`;
    }
    html += '</div>';
  }

  container.innerHTML = html;
}

// --- Local timezone formatter (auto-detect system timezone) ---
function formatLocalTime(str) {
  if (!str) return '';
  // Already formatted short string (e.g. "16:06" or "오후 4:06")
  if (str.length < 12 && !str.includes('T') && !str.includes('Z')) return str;
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// --- Status label helper (3-state: Waiting / 작업중 / Done) ---
// agent 객체의 note/task 필드에 "대기"/"waiting" 등 키워드가 있으면 Waiting으로 표시
function getProgressLabel(pct, agent) {
  if (pct >= 100) return 'Done';
  if (pct > 0) {
    if (agent) {
      const text = ((agent.note || '') + ' ' + (agent.task || '')).toLowerCase();
      if (text.includes('대기') || text.includes('waiting') || text.includes('awaiting')
          || text.includes('idle') || text.includes('pending')) {
        return 'Waiting';
      }
    }
    return '작업중';
  }
  return 'Waiting';
}

function renderLiveAgents(km) {
  const container = document.getElementById('mc-agents');
  const countEl = document.getElementById('mc-agent-count');

  let agents = km.progress?.agents || [];
  const teamMembers = km.plan?.team || [];
  const bulletinEntries = km.bulletin?.entries || [];
  const teams = km.progress?.teams || null;

  // Fallback: progress가 비어있으면 plan.team에서 에이전트 생성
  if (!agents.length && teamMembers.length) {
    agents = teamMembers.map(m => {
      const cleanName = (m.name || '').replace(/^@/, '');
      const recentEntry = bulletinEntries.find(e =>
        e.agent && cleanName && e.agent.toLowerCase().includes(cleanName.toLowerCase())
      );
      const isCompleted = recentEntry && (recentEntry.status || '').toLowerCase() === 'completed';
      const isActive = recentEntry && !isCompleted;
      return {
        agent: m.name || '',
        task: recentEntry?.task || m.role || '',
        progress: isCompleted ? 100 : (isActive ? 50 : 0),
        updated: recentEntry?.time || '',
        note: recentEntry?.status || m.status || 'pending',
      };
    });
  }

  countEl.textContent = agents.length;

  if (!agents.length) {
    container.className = 'mc-agents empty';
    container.innerHTML = '';
    return;
  }

  container.className = 'mc-agents';

  // Team-grouped rendering when teams data is available and has multiple teams
  const teamKeys = teams ? Object.keys(teams) : [];
  if (teams && teamKeys.length > 1) {
    // Multi-team: render with team group headers + collapsible sections
    container.innerHTML = teamKeys.map(teamName => {
      const teamData = teams[teamName];
      const teamAgents = teamData.agents || [];
      return `<div class="team-group">
        <div class="team-group-header" onclick="this.parentElement.classList.toggle('collapsed')">
          <span class="team-group-name">${escHtml(teamName)}</span>
          <span class="team-group-stats">${teamData.activeCount || 0} active / ${teamAgents.length} total</span>
          <span class="team-group-avg">${teamData.avgProgress || 0}%</span>
          <span class="team-group-toggle">▼</span>
        </div>
        <div class="team-group-agents">
          ${renderAgentTiles(teamAgents, teamMembers, agents)}
        </div>
      </div>`;
    }).join('');
  } else {
    // Single team or no team grouping: flat rendering (backward compatible)
    container.innerHTML = renderAgentTiles(agents, teamMembers, agents);
  }
}

// Render agent tiles (shared between single/multi-team modes)
function renderAgentTiles(agentsToRender, teamMembers, allAgents) {
  return agentsToRender.map((a) => {
    // Find global index for modal
    const globalIdx = allAgents.findIndex(g => g.agent === a.agent);
    const idx = globalIdx >= 0 ? globalIdx : 0;
    const statusClass = getAgentStatusClass(a);
    const pct = a.progress || 0;

    // Match with plan team to get model info
    const member = teamMembers.find(m => m.name === a.agent);
    const model = member?.model || '';

    // Task count badge (from _taskProgress)
    const tp = a._taskProgress;
    const taskCountHtml = tp
      ? `<span class="agent-tile-task-count">${tp.completedTasks}/${tp.totalTasks} tasks</span>`
      : '';

    return `<div class="agent-tile ${statusClass}" onclick="showAgentModal(${idx})">
      <div class="agent-tile-header">
        <span class="agent-icon">${generateAgentIcon(a.agent, 30)}</span>
        <div class="agent-tile-name">${escHtml(a.agent)}</div>
        <span class="agent-status-dot"></span>
      </div>
      ${model ? `<div class="agent-tile-model">${escHtml(model)}</div>` : ''}
      <div class="agent-tile-task">${escHtml(a.task) || 'Waiting...'}</div>
      <div class="agent-tile-status-badge ${statusClass}">${getProgressLabel(pct, a)}</div>
      <div class="agent-tile-footer">
        ${taskCountHtml}
        <span class="agent-tile-time">${escHtml(formatLocalTime(a.updated)) || ''}</span>
      </div>
    </div>`;
  }).join('');
}

function getAgentStatusClass(agent) {
  if (agent.progress >= 100) return 'status-done';
  if (agent.progress > 0) {
    const text = ((agent.note || '') + ' ' + (agent.task || '')).toLowerCase();
    if (text.includes('대기') || text.includes('waiting') || text.includes('awaiting')
        || text.includes('idle') || text.includes('pending')) {
      return 'status-waiting';
    }
    return 'status-working';
  }
  return 'status-waiting';
}

// --- Sprint Steps Toggle ---

function toggleSprintSteps() {
  const stepsEl = document.getElementById('mc-sprint-steps');
  const toggleEl = document.getElementById('mc-sprint-toggle');
  if (!stepsEl || !toggleEl) return;
  stepsEl.classList.toggle('collapsed');
  toggleEl.classList.toggle('collapsed');
}

// --- Sprint Steps Helpers ---

function getRoleBadgeType(assignee) {
  if (!assignee) return 'worker';
  const lower = assignee.toLowerCase();
  if (lower.includes('lead') || lower.includes('리드')) return 'lead';
  if (lower.includes('category') || lower.includes('카테고리')) return 'category';
  return 'worker';
}

function findRalphScoreForStep(bulletin, step) {
  if (!bulletin || !bulletin.length || !step) return null;
  const stepName = (step.assignee || step.name || '').toLowerCase();
  if (!stepName) return null;

  for (let i = bulletin.length - 1; i >= 0; i--) {
    const entry = bulletin[i];
    const content = ((entry.findings || '') + ' ' + (entry.task || '')).toLowerCase();
    if (content.includes(stepName) && (content.includes('ralph') || content.includes('ship') || content.includes('revise'))) {
      const scoreMatch = content.match(/합계[^0-9]*([0-9.]+)/);
      const score = scoreMatch ? parseFloat(scoreMatch[1]) : null;
      const verdict = content.includes('ship') ? 'ship' : content.includes('revise') ? 'revise' : null;
      if (verdict) return { score: score ? score.toFixed(1) : '?', verdict };
    }
  }
  return null;
}

function renderSprintSteps(km) {
  const container = document.getElementById('mc-sprint-steps');
  const countBadge = document.getElementById('mc-sprint-count');
  if (!container) return;

  if (!km || !km.plan || !km.plan.steps) {
    container.innerHTML = '<div class="mc-empty">No sprint steps</div>';
    if (countBadge) countBadge.textContent = '0';
    return;
  }

  const steps = km.plan.steps;
  if (countBadge) countBadge.textContent = steps.length;

  container.innerHTML = steps.map((step, i) => {
    const statusIcon = step.status === 'done' ? '\u2713'
                      : step.status === 'active' ? '\u25D0' : '\u25CB';
    const statusClass = step.status === 'done' ? 'step-done'
                       : step.status === 'active' ? 'step-active' : 'step-pending';

    const roleBadge = step.assignee
      ? `<span class="role-badge role-${getRoleBadgeType(step.assignee)}">${escHtml(step.assignee)}</span>`
      : '';

    const modelBadge = step.model
      ? `<span class="model-badge">${escHtml(step.model)}</span>`
      : '';

    const ralphScore = findRalphScoreForStep(km.bulletin, step);
    const ralphHtml = ralphScore
      ? `<div class="step-ralph">
           <span class="ralph-mini-badge ${ralphScore.verdict}">${ralphScore.verdict.toUpperCase()}</span>
           <span class="ralph-mini-score">${ralphScore.score}/5</span>
         </div>`
      : '';

    const outputHtml = step.output
      ? `<div class="step-output"><span class="output-icon">\uD83D\uDCC4</span>${escHtml(step.output)}</div>`
      : '';

    const gateHtml = step.gate
      ? `<div class="step-gate ${step.gatePass ? 'gate-pass' : 'gate-pending'}">
           ${step.gatePass ? '\u2705' : '\u2B1C'} ${escHtml(step.gate)}
         </div>`
      : '';

    return `
      <div class="sprint-step-card ${statusClass}">
        <div class="step-header">
          <span class="step-number">S${i + 1}</span>
          <span class="step-status-icon">${statusIcon}</span>
          <span class="step-title">${escHtml(step.text || step.name || 'Step ' + (i + 1))}</span>
          ${roleBadge}
          ${modelBadge}
        </div>
        <div class="step-body">
          ${step.description ? `<p class="step-desc">${escHtml(step.description)}</p>` : ''}
          ${ralphHtml}
          ${gateHtml}
          ${outputHtml}
        </div>
      </div>`;
  }).join('');
}

function renderPixelWorkflowBar(km) {
  const bar = document.getElementById('pixel-workflow-bar');
  if (!bar) return;
  const steps = km?.plan?.steps || [];
  if (!steps.length) { bar.innerHTML = ''; return; }

  bar.innerHTML = steps.map((s, i) => {
    const st = (s.status || '').toLowerCase();
    const cls = st.includes('done') || st.includes('complete') ? 'pw-done' :
                st.includes('active') || st.includes('progress') ? 'pw-active' : 'pw-pending';
    const icon = cls === 'pw-done' ? '\u2713' : cls === 'pw-active' ? '\u25B6' : '\u25CB';
    const arrow = i < steps.length - 1 ? '<span class="pw-step-arrow">\u2192</span>' : '';
    return `<div class="pw-step ${cls}"><span class="pw-step-num">${i + 1}</span>${icon} ${escHtml(s.step || '')}${s.assignee ? ' <span style="opacity:0.5">@' + escHtml((s.assignee || '').replace(/^@/, '')) + '</span>' : ''}</div>${arrow}`;
  }).join('');
}

function renderCheckpoints(km) {
  const container = document.getElementById('mc-checkpoints');
  const checkpoints = km.progress?.checkpoints || [];

  if (!checkpoints.length) {
    container.className = 'mc-checkpoints empty';
    container.innerHTML = '';
    return;
  }

  container.className = 'mc-checkpoints';
  const html = [];

  for (let i = 0; i < checkpoints.length; i++) {
    const cp = checkpoints[i];
    let cls = '';
    let icon = '';
    let statusText = 'Pending';

    if (cp.done) {
      cls = 'done';
      icon = '\u2713'; // ✓
      statusText = 'Complete';
    } else {
      const prevAllDone = checkpoints.slice(0, i).every(c => c.done);
      if (prevAllDone && i > 0 || (i === 0 && !cp.done)) {
        const anyAgentActive = (km.progress?.agents || []).some(a => a.progress > 0 && a.progress < 100);
        if (anyAgentActive) {
          cls = 'in-progress';
          icon = '\u25D0'; // ◐
          statusText = 'In Progress';
        } else {
          icon = '\u25CB'; // ○
        }
      } else {
        icon = '\u25CB'; // ○
      }
    }

    html.push(`<div class="checkpoint ${cls}">
      <span class="checkpoint-icon">${icon}</span>
      <div class="checkpoint-info">
        <span class="checkpoint-name">${escHtml(cp.name)}</span>
        <span class="checkpoint-status-text">${statusText}</span>
      </div>
    </div>`);

    // Vertical arrow between checkpoints (not after the last one)
    if (i < checkpoints.length - 1) {
      // Arrow state: done if current checkpoint is done, in-progress if current is in-progress
      const arrowCls = cls === 'done' ? 'done' : cls === 'in-progress' ? 'in-progress' : '';
      html.push(`<div class="checkpoint-arrow-down ${arrowCls}">\u2193</div>`);
    }
  }

  container.innerHTML = html.join('');
}

// --- Bulletin Helpers ---

function detectMessageType(entry) {
  const content = ((entry.findings || '') + ' ' + (entry.task || '') + ' ' + (entry.status || '')).toLowerCase();

  if (content.includes('ship') || content.includes('ralph') && content.includes('pass')) {
    return { type: 'review', verdict: 'ship' };
  }
  if (content.includes('revise') || content.includes('ralph') && content.includes('fail')) {
    return { type: 'review', verdict: 'revise' };
  }
  if (content.includes('error') || content.includes('\uc624\ub958') || content.includes('fail')) {
    return { type: 'error' };
  }
  if (entry.status === 'completed' || content.includes('\uc644\ub8cc') || content.includes('complete') || content.includes('done')) {
    return { type: 'completion' };
  }
  if (content.includes('\ubc1c\uacac') || content.includes('finding') || content.includes('discovered') || content.includes('found')) {
    return { type: 'finding' };
  }
  return { type: 'update' };
}

function extractTargetAgent(entry) {
  const content = (entry.findings || '') + ' ' + (entry.task || '');
  const matches = content.match(/@([\w-]+)/g);
  if (matches) {
    // Filter out the sender
    const targets = matches.map(m => m.slice(1)).filter(name => name !== entry.agent);
    return targets[0] || null;
  }
  return null;
}

function getMsgBadge(msgInfo) {
  if (msgInfo.type === 'review') {
    return msgInfo.verdict === 'ship'
      ? '<span class="msg-type-badge verdict-ship">SHIP</span>'
      : '<span class="msg-type-badge verdict-revise">REVISE</span>';
  }
  if (msgInfo.type === 'completion') return '<span class="msg-type-badge msg-complete">\u2713 Done</span>';
  if (msgInfo.type === 'finding') return '<span class="msg-type-badge msg-finding">Finding</span>';
  if (msgInfo.type === 'error') return '<span class="msg-type-badge msg-error">\u26A0 Error</span>';
  return '';
}

function getBulletinEntryClass(msgInfo) {
  if (msgInfo.type === 'review') return 'bulletin-entry-review';
  if (msgInfo.type === 'error') return 'bulletin-entry-error';
  if (msgInfo.type === 'finding') return 'bulletin-entry-finding';
  if (msgInfo.type === 'completion') return 'bulletin-entry-completion';
  return '';
}

// P1: Bulletin with search/filter + message type visualization
function renderBulletin(km) {
  const container = document.getElementById('mc-bulletin');
  const countEl = document.getElementById('mc-bulletin-count');
  const entries = km.bulletin?.entries || [];
  bulletinData = entries;

  countEl.textContent = entries.length;

  const searchEl = document.getElementById('mc-bulletin-search');
  const query = searchEl ? searchEl.value.toLowerCase().trim() : '';

  const filtered = query
    ? entries.filter(e => {
        const text = `${e.agent || ''} ${e.findings || ''} ${e.task || ''}`.toLowerCase();
        return text.includes(query);
      })
    : entries;

  if (!filtered.length) {
    container.className = 'mc-bulletin empty';
    container.innerHTML = '';
    return;
  }

  container.className = 'mc-bulletin';
  container.innerHTML = filtered.slice(0, 30).map(e => {
    const timeShort = e.time ? (e.time.split(' ').pop() || e.time) : '';
    const content = e.findings || e.task || '';
    const msgInfo = detectMessageType(e);
    const targetAgent = extractTargetAgent(e);
    const badge = getMsgBadge(msgInfo);
    const entryClass = getBulletinEntryClass(msgInfo);

    // Agent direction display with mini icon
    let agentHtml = `<span class="agent-icon agent-icon-sm">${generateAgentIcon(e.agent, 20)}</span><span class="bulletin-agent">@${escHtml(e.agent)}</span>`;
    if (targetAgent) {
      agentHtml += `<span class="msg-arrow">\u2192</span><span class="agent-icon agent-icon-sm">${generateAgentIcon(targetAgent, 20)}</span><span class="bulletin-agent-target">@${escHtml(targetAgent)}</span>`;
    }

    return `<div class="bulletin-entry ${entryClass}">
      <span class="bulletin-time">${escHtml(timeShort)}</span>
      ${agentHtml}
      ${badge}
      <span class="bulletin-content">${escHtml(content)}</span>
    </div>`;
  }).join('');
}

// === Inventory Grid ===

function renderList(id, items, labelFn) {
  const list = document.getElementById(`list-${id}`);
  const count = document.getElementById(`count-${id}`);
  count.textContent = items.length;
  list.innerHTML = items.map(item =>
    `<div class="item"><span>${escHtml(labelFn(item))}</span></div>`
  ).join('');
}

function renderMCP(servers) {
  const list = document.getElementById('list-mcp');
  const count = document.getElementById('count-mcp');
  count.textContent = servers.length;
  list.innerHTML = servers.map(s =>
    `<div class="item">
      <span>${escHtml(s.name)}</span>
      <span class="tag">${escHtml(s.type)}</span>
    </div>`
  ).join('');
}

function renderHooks(hooks) {
  const list = document.getElementById('list-hooks');
  const count = document.getElementById('count-hooks');
  count.textContent = hooks.length;
  list.innerHTML = hooks.map(h =>
    `<div class="item">
      <span>${escHtml(h.event)}</span>
      <span class="tag">${escHtml(h.type)}</span>
    </div>`
  ).join('');
}

function renderPermissions(perms) {
  const list = document.getElementById('list-permissions');
  const count = document.getElementById('count-permissions');
  count.textContent = perms.length;
  list.innerHTML = perms.map(p =>
    `<div class="item"><span>${escHtml(p.tool)}${p.pattern ? `(${escHtml(truncate(p.pattern, 40))})` : ''}</span></div>`
  ).join('');
}

function renderPlugins(plugins) {
  const list = document.getElementById('list-plugins');
  const count = document.getElementById('count-plugins');
  count.textContent = plugins.length;
  list.innerHTML = plugins.length
    ? plugins.map(p => `<div class="item"><span>${escHtml(p)}</span></div>`).join('')
    : '<div class="item" style="color:var(--text-muted)">No plugins enabled</div>';
}

// P4: Team OS with Bootstrap button
function renderTeamOS(teamOS) {
  const list = document.getElementById('list-team-os');
  const badge = document.getElementById('status-team-os');
  const bootstrapBtn = document.getElementById('btn-team-os-bootstrap');

  const statusClass = teamOS.status === 'active' ? 'active' : teamOS.status === 'partial' ? 'partial' : 'inactive';
  const statusLabel = teamOS.status === 'active' ? 'Active' : teamOS.status === 'partial' ? 'Partial' : 'Inactive';
  badge.innerHTML = `<span class="status-badge ${statusClass}">${statusLabel}</span>`;

  // Show bootstrap button if not active
  if (bootstrapBtn) {
    bootstrapBtn.style.display = teamOS.status !== 'active' ? 'block' : 'none';
  }

  let html = '';

  html += `<div class="card-section">
    <div class="card-section-title">Infrastructure</div>
    <div class="item item-clickable" onclick="showArtifactList()">
      <span>registry.yaml</span><span class="tag">${teamOS.registry ? 'OK' : 'Missing'}</span>
    </div>
  </div>`;

  if (teamOS.spawnPrompts.length) {
    html += `<div class="card-section">
      <div class="card-section-title">Spawn Prompts (${teamOS.spawnPrompts.length})</div>
      ${teamOS.spawnPrompts.map(p => `<div class="item"><span>${escHtml(p)}</span></div>`).join('')}
    </div>`;
  }

  if (teamOS.hooks.length) {
    html += `<div class="card-section">
      <div class="card-section-title">Hooks (${teamOS.hooks.length})</div>
      ${teamOS.hooks.map(h => `<div class="item"><span>${escHtml(h)}</span></div>`).join('')}
    </div>`;
  }

  list.innerHTML = html;
}

// P5: Session Metrics
async function renderMetrics() {
  const list = document.getElementById('list-metrics');
  const count = document.getElementById('count-metrics');
  if (!list || !count) return;

  try {
    const res = await fetch('/api/metrics');
    const data = await res.json();
    const agents = data.agents || [];
    count.textContent = data.totalSessions || 0;

    if (!agents.length) {
      list.innerHTML = '<div class="item" style="color:var(--text-muted)">No metrics data yet</div>';
      return;
    }

    const maxCount = Math.max(...agents.map(a => a.taskCount), 1);
    list.innerHTML = `<div class="metric-bar-container">
      ${agents.slice(0, 10).map(a => {
        const pct = Math.round((a.taskCount / maxCount) * 100);
        return `<div class="metric-bar-row">
          <span class="metric-bar-label">${escHtml(a.name)}</span>
          <div class="metric-bar-track">
            <div class="metric-bar-fill" style="width:${pct}%"></div>
          </div>
          <span class="metric-bar-value">${a.taskCount}</span>
        </div>`;
      }).join('')}
    </div>`;
  } catch {
    list.innerHTML = '<div class="item" style="color:var(--text-muted)">Failed to load metrics</div>';
    count.textContent = '-';
  }
}

// P6: Ralph Reviews Visualization
function renderRalphReviews(km) {
  km = km || {};
  const list = document.getElementById('list-ralph');
  const count = document.getElementById('count-ralph');
  if (!list || !count) return;

  const entries = km.bulletin?.entries || [];
  // Filter entries that look like Ralph Reviews
  const reviews = entries.filter(e => {
    const content = (e.findings || e.task || '').toLowerCase();
    return content.includes('ralph') || content.includes('ship') || content.includes('revise')
      || content.includes('rubric') || content.includes('weighted_score');
  });

  count.textContent = reviews.length;

  if (!reviews.length) {
    list.innerHTML = '<div class="item" style="color:var(--text-muted)">No Ralph reviews yet</div>';
    return;
  }

  list.innerHTML = reviews.slice(0, 10).map(r => {
    const content = r.findings || r.task || '';
    const isShip = content.toLowerCase().includes('ship');
    const verdict = isShip ? 'SHIP' : 'REVISE';
    const verdictClass = isShip ? 'ship' : 'revise';

    // Try to extract scores from content (format: "차원: X/5" or similar)
    const dimensions = ['completeness', 'accuracy', 'coverage', 'format_compliance'];
    const dimScores = dimensions.map(dim => {
      const regex = new RegExp(dim + '[:\\s]+(\\d)', 'i');
      const match = content.match(regex);
      return { name: dim, score: match ? parseInt(match[1]) : 0 };
    });

    // Try to extract weighted score
    const wsMatch = content.match(/(\d+\.?\d*)\s*\/?\s*5?\s*$/m) || content.match(/합계[:\s]*\*?\*?(\d+\.?\d*)/);
    const weightedScore = wsMatch ? parseFloat(wsMatch[1]) : null;

    const hasDimScores = dimScores.some(d => d.score > 0);

    return `<div class="ralph-card">
      <div class="ralph-card-header">
        <span class="ralph-card-worker">@${escHtml(r.agent)}</span>
        <span class="ralph-card-verdict ${verdictClass}">${verdict}</span>
      </div>
      ${hasDimScores ? `<div class="ralph-dimensions">
        ${dimScores.map(d => {
          const pct = (d.score / 5) * 100;
          const fillClass = d.score >= 4 ? 'high' : d.score >= 3 ? 'mid' : 'low';
          return `<div class="ralph-dim-row">
            <span class="ralph-dim-name">${escHtml(d.name)}</span>
            <div class="ralph-dim-bar">
              <div class="ralph-dim-fill ${fillClass}" style="width:${pct}%"></div>
            </div>
            <span class="ralph-dim-score">${d.score}/5</span>
          </div>`;
        }).join('')}
      </div>` : ''}
      ${weightedScore !== null ? `<div class="ralph-card-total">Score: ${weightedScore.toFixed(1)} / 5.0</div>` : ''}
      ${!hasDimScores ? `<div style="font-size:10px;color:var(--text-secondary);margin-top:4px">${escHtml(truncate(content, 120))}</div>` : ''}
    </div>`;
  }).join('');
}

// === P2: Agent Detail Modal ===

function showAgentModal(idx) {
  const km = lastKmWorkflow;
  if (!km) return;

  const progressAgents = km.progress?.agents || [];
  const planTeam = km.plan?.team || [];
  const bulletinEntries = km.bulletin?.entries || [];
  const findingsNotes = km.findings?.coreNotes || [];
  const findingsInsights = km.findings?.keyInsights || [];
  const steps = km.plan?.steps || [];

  // Get agent from progress or plan
  let agent = progressAgents[idx];
  if (!agent && planTeam[idx]) {
    const m = planTeam[idx];
    agent = { agent: m.name, task: m.role, progress: 0, note: m.status };
  }
  if (!agent) return;

  const name = (agent.agent || '').replace(/^@/, '');
  const meta = planTeam.find(t => (t.name || '').replace(/^@/, '') === name) || {};

  // Filter bulletin entries for this agent
  const agentBulletins = bulletinEntries.filter(e =>
    e.agent && name && e.agent.toLowerCase().includes(name.toLowerCase())
  );

  // Filter findings for this agent
  const agentFindings = (km.findings?.agentResults || []).filter(r =>
    r.agent && name && r.agent.toLowerCase().includes(name.toLowerCase())
  );

  // Find assigned steps
  const agentSteps = steps.filter(s =>
    s.assignee && name && s.assignee.toLowerCase().includes(name.toLowerCase())
  );

  // Determine role badge
  const roleLower = (meta.role || '').toLowerCase();
  const isLead = roleLower.includes('lead') || roleLower.includes('총괄') ||
                 name.toLowerCase().includes('lead') || name.toLowerCase().includes('main') ||
                 (meta.model || '').toLowerCase().includes('opus');
  const roleClass = isLead ? 'role-lead' : 'role-worker';
  const roleLabel = isLead ? 'LEAD' : 'WORKER';

  const pct = parseInt(agent.progress) || 0;
  const barColor = pct >= 100 ? 'var(--status-active)' : 'var(--accent)';

  // Build modal content
  let html = '';

  // Header info
  html += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">`;
  html += generateAgentIcon(name, 40);
  html += `<div style="flex:1">`;
  html += `<div style="font-size:18px;font-weight:700;color:#e2e8f0">${escHtml(name)}</div>`;
  html += `<div style="display:flex;gap:6px;align-items:center;margin-top:4px;">`;
  html += `<span class="role-badge ${roleClass}">${roleLabel}</span>`;
  if (meta.model) html += `<span class="model-badge">${escHtml(meta.model)}</span>`;
  html += `</div>`;
  html += `</div>`;
  html += `<div style="text-align:right">`;
  html += `<div style="font-size:24px;font-weight:700;color:${barColor}">${pct}%</div>`;
  html += `<div style="font-size:10px;color:var(--text-muted)">${escHtml(agent.note || '')}</div>`;
  html += `</div></div>`;

  // Progress bar
  html += `<div style="height:6px;background:var(--border);border-radius:3px;margin-bottom:16px;overflow:hidden">`;
  html += `<div style="height:100%;width:${pct}%;background:${barColor};border-radius:3px;transition:width 0.5s"></div>`;
  html += `</div>`;

  // Task info
  if (meta.role || agent.task) {
    html += `<div style="margin-bottom:12px;padding:8px 12px;background:var(--bg-secondary);border-radius:4px;border:1px solid var(--border)">`;
    html += `<div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Current Task</div>`;
    html += `<div style="font-size:13px;color:#cbd5e1">${escHtml(agent.task || meta.role || '')}</div>`;
    html += `</div>`;
  }

  // Assigned Steps
  if (agentSteps.length) {
    html += `<div style="margin-bottom:12px">`;
    html += `<div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">Assigned Steps</div>`;
    agentSteps.forEach(s => {
      const st = (s.status || '').toLowerCase();
      const stepCls = st.includes('done') || st.includes('complete') ? 'color:var(--status-active)' :
                      st.includes('active') || st.includes('progress') ? 'color:var(--accent)' : 'color:var(--text-muted)';
      const icon = st.includes('done') || st.includes('complete') ? '\u2713' : st.includes('active') || st.includes('progress') ? '\u25B6' : '\u25CB';
      html += `<div style="padding:4px 8px;font-size:12px;${stepCls}">${icon} ${escHtml(s.step || '')} ${s.dependency ? '<span style="opacity:0.4;font-size:10px">\u2190 ' + escHtml(s.dependency) + '</span>' : ''}</div>`;
    });
    html += `</div>`;
  }

  // Timeline (bulletin entries)
  html += `<div style="margin-bottom:12px">`;
  html += `<div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">Activity Timeline (${agentBulletins.length} entries)</div>`;
  if (agentBulletins.length === 0) {
    html += `<div style="font-size:12px;color:var(--text-muted);padding:8px 0">No activity recorded yet.</div>`;
  } else {
    html += `<div style="max-height:200px;overflow-y:auto;scrollbar-width:thin">`;
    agentBulletins.forEach(e => {
      const statusColor = (e.status || '').toLowerCase().includes('completed') ? 'var(--status-active)' :
                          (e.status || '').toLowerCase().includes('active') ? 'var(--accent)' : 'var(--text-muted)';
      html += `<div style="padding:6px 8px;border-left:2px solid ${statusColor};margin-bottom:4px;font-size:12px">`;
      html += `<div style="display:flex;justify-content:space-between">`;
      html += `<span style="color:var(--text-muted);font-size:10px">${escHtml(e.time || '')}</span>`;
      if (e.status) html += `<span style="color:${statusColor};font-size:10px;font-weight:600">${escHtml(e.status)}</span>`;
      html += `</div>`;
      if (e.task) html += `<div style="color:#a0aec0;margin-top:2px">${escHtml(e.task)}</div>`;
      if (e.findings) html += `<div style="color:#cbd5e1;margin-top:2px">${escHtml(e.findings)}</div>`;
      html += `</div>`;
    });
    html += `</div>`;
  }
  html += `</div>`;

  // Findings (if any)
  if (agentFindings.length) {
    html += `<div style="margin-bottom:12px">`;
    html += `<div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">Findings</div>`;
    agentFindings.forEach(f => {
      html += `<div style="padding:8px 12px;background:var(--bg-secondary);border-radius:4px;border:1px solid var(--border);margin-bottom:4px">`;
      html += `<div style="font-size:12px;color:#cbd5e1">${escHtml(f.summary || f.details || '')}</div>`;
      html += `</div>`;
    });
    html += `</div>`;
  }

  // Related core notes from findings
  const relatedNotes = findingsNotes.filter(n =>
    n.source && name && n.source.toLowerCase().includes(name.toLowerCase())
  );
  if (relatedNotes.length) {
    html += `<div style="margin-bottom:12px">`;
    html += `<div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">Referenced Notes</div>`;
    relatedNotes.forEach(n => {
      html += `<div style="padding:4px 8px;font-size:11px;color:#a0aec0">\uD83D\uDCC4 ${escHtml(n.path || '')} <span style="opacity:0.5">\u2014 ${escHtml(n.relevance || '')}</span></div>`;
    });
    html += `</div>`;
  }

  // Show modal
  openModal(`Agent: ${name}`, html, '');
}

// === P3: Artifact Viewer/Editor ===

async function showArtifactList() {
  try {
    const res = await fetch('/api/artifacts');
    const files = await res.json();

    if (!files.length) {
      openModal('Artifacts', '<div style="color:var(--text-muted)">No artifacts found. Run a team workflow first.</div>', '');
      return;
    }

    const bodyHtml = files.map(f =>
      `<div class="item item-clickable" onclick="showArtifactEditor('${escHtml(f.name)}')">
        <span>${escHtml(f.name)}</span>
        <span class="tag">${(f.size / 1024).toFixed(1)}KB</span>
      </div>`
    ).join('');

    openModal('Artifacts', bodyHtml, '');
  } catch {
    openModal('Artifacts', '<div style="color:var(--status-inactive)">Failed to load artifacts</div>', '');
  }
}

async function showArtifactEditor(filename) {
  try {
    const res = await fetch(`/api/artifacts/${encodeURIComponent(filename)}`);
    if (!res.ok) {
      openModal(filename, `<div style="color:var(--status-inactive)">File not found or not allowed</div>`, '');
      return;
    }
    const data = await res.json();

    const bodyHtml = `<textarea class="artifact-textarea" id="artifact-content">${escHtml(data.content)}</textarea>`;
    const footerHtml = `
      <button class="btn" onclick="saveArtifact('${escHtml(filename)}')">Save</button>
      <button class="btn" onclick="closeModal()" style="border-color:var(--text-muted);color:var(--text-muted)">Cancel</button>`;

    openModal(filename, bodyHtml, footerHtml);
  } catch {
    openModal(filename, '<div style="color:var(--status-inactive)">Failed to load file</div>', '');
  }
}

async function saveArtifact(filename) {
  const textarea = document.getElementById('artifact-content');
  if (!textarea) return;

  try {
    const res = await fetch(`/api/artifacts/${encodeURIComponent(filename)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: textarea.value }),
    });
    const result = await res.json();
    if (result.success) {
      closeModal();
      fetchStatus();
    } else {
      alert('Save failed: ' + (result.error || 'Unknown error'));
    }
  } catch (e) {
    alert('Save failed: ' + e.message);
  }
}

// === Modal ===

function openModal(title, bodyHtml, footerHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-footer').innerHTML = footerHtml || '';
  document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// === Utilities ===

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '...' : str;
}

function timeSince(date) {
  const seconds = Math.floor((Date.now() - date) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// === Session Clear ===

async function clearSession() {
  if (!confirm('팀 세션 데이터를 초기화할까요?\n(agents_memory.md와 MEMORY.md는 유지됩니다)')) return;
  try {
    await fetch('/api/session/clear', { method: 'POST' });
    lastKmWorkflow = null;
    bulletinData = [];
    fetchStatus();
  } catch (e) {
    console.error('Clear session failed:', e);
  }
}

// === SSE ===

function connectSSE() {
  const source = new EventSource('/events');

  source.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      const cardMap = {
        agents_updated: 'card-agents',
        skills_updated: 'card-skills',
        commands_updated: 'card-commands',
        mcp_updated: 'card-mcp',
        team_os_updated: 'card-team-os',
        settings_updated: 'card-hooks',
      };

      const cardId = cardMap[msg.type];
      if (cardId) flashCard(cardId);

      // Team OS updates also refresh Mission Control + Ralph
      if (msg.type === 'team_os_updated') {
        flashMissionControl();
        flashCard('card-ralph');
        flashCard('card-metrics');
      }

      // Real-time progress push: update single agent tile + graph node without full re-fetch
      if (msg.type === 'progress_push' && msg.data && lastKmWorkflow) {
        const pushData = msg.data;
        const agents = lastKmWorkflow.progress?.agents || [];

        // Batch "all done" signal
        if (pushData.batch && pushData.allDone) {
          for (const a of agents) {
            a.progress = 100;
            a.task = 'completed';
            a.note = 'all done';
            a.updated = new Date().toLocaleTimeString();
          }
        } else {
          const cleanName = (pushData.agent || '').replace(/^@/, '');
          const existing = agents.find(a => (a.agent || '').replace(/^@/, '') === cleanName);
          if (existing) {
            existing.progress = pushData.progress || existing.progress;
            existing.task = pushData.task || existing.task;
            existing.note = pushData.note || existing.note;
            existing.updated = new Date().toLocaleTimeString();
          }
        }
        // Re-render only affected sections (lightweight)
        renderLiveAgents(lastKmWorkflow);
        renderNodeGraph(lastKmWorkflow);
        return; // Skip full fetchStatus for progress_push
      }

      fetchStatus();
    } catch { /* ignore */ }
  };

  source.onerror = () => {
    document.getElementById('live-dot').style.background = 'var(--status-inactive)';
    setTimeout(() => {
      source.close();
      connectSSE();
    }, 3000);
  };

  source.onopen = () => {
    document.getElementById('live-dot').style.background = 'var(--status-active)';
  };
}

function flashCard(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  card.classList.add('updated');
  setTimeout(() => card.classList.remove('updated'), 1500);
}

function flashMissionControl() {
  const mc = document.getElementById('mission-control');
  if (!mc) return;
  mc.querySelectorAll('.mc-section').forEach(s => {
    s.style.borderColor = 'var(--accent)';
    setTimeout(() => s.style.borderColor = '', 1500);
  });
}

// === Results Tab ===

let _currentSourceFilter = 'all';

async function fetchReports() {
  const listEl = document.getElementById('results-list');
  const countEl = document.getElementById('results-count');
  const detailEl = document.getElementById('results-detail');
  if (!listEl) return;

  try {
    const res = await fetch('/api/reports');
    const reports = await res.json();

    // sourceCommand 추론 (기존 보고서 호환)
    reports.forEach(r => {
      if (!r.sourceCommand) {
        r.sourceCommand = (r.teamName || '').includes('km-at') ? '/knowledge-manager-at' : '/teamify';
      }
    });

    if (!reports.length) {
      if (countEl) countEl.textContent = '0';
      const filterEl = document.getElementById('results-filter');
      if (filterEl) filterEl.innerHTML = '';
      listEl.innerHTML = '<div class="results-empty">No reports yet. Run /teamify to generate team execution reports.</div>';
      return;
    }

    // 필터 칩 렌더
    const sources = ['all', ...new Set(reports.map(r => r.sourceCommand))];
    const filterEl = document.getElementById('results-filter');
    if (filterEl) {
      filterEl.innerHTML = sources.map(s =>
        `<button class="results-filter-chip ${_currentSourceFilter === s ? 'active' : ''}" onclick="filterReports('${s}')">${s === 'all' ? '전체' : s}</button>`
      ).join('');
    }

    // 필터 적용
    const filtered = _currentSourceFilter === 'all' ? reports : reports.filter(r => r.sourceCommand === _currentSourceFilter);
    if (countEl) countEl.textContent = `${filtered.length}/${reports.length}`;

    if (detailEl) detailEl.style.display = 'none';
    listEl.style.display = '';

    listEl.innerHTML = filtered.map(r => {
      const date = r.timestamp ? new Date(r.timestamp).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
      return `<div class="report-card" onclick="loadReport('${escHtml(r.id)}')">
        <div class="report-card-header">
          <span class="report-card-team">${escHtml(r.teamName)}</span>
          <span class="report-card-source">${escHtml(r.sourceCommand)}</span>
          <span class="report-card-complexity">${escHtml(r.complexity || '')}</span>
        </div>
        <div class="report-card-subject">${escHtml(r.subject)}</div>
        <div class="report-card-footer">
          <span class="report-card-date">${escHtml(date)}</span>
          ${r.duration ? `<span class="report-card-duration">${escHtml(r.duration)}</span>` : ''}
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    listEl.innerHTML = '<div class="results-empty">Failed to load reports.</div>';
    console.error('fetchReports error:', e);
  }
}

function filterReports(source) {
  _currentSourceFilter = source;
  fetchReports();
}

async function loadReport(id) {
  const listEl = document.getElementById('results-list');
  const detailEl = document.getElementById('results-detail');
  const contentEl = document.getElementById('results-detail-content');
  if (!detailEl || !contentEl) return;

  try {
    const res = await fetch(`/api/reports/${encodeURIComponent(id)}`);
    if (!res.ok) { contentEl.innerHTML = '<div class="results-empty">Report not found.</div>'; return; }
    const report = await res.json();

    if (listEl) listEl.style.display = 'none';
    detailEl.style.display = '';
    contentEl.innerHTML = renderReportDetail(report);
  } catch (e) {
    contentEl.innerHTML = '<div class="results-empty">Failed to load report.</div>';
    console.error('loadReport error:', e);
  }
}

function showResultsList() {
  const listEl = document.getElementById('results-list');
  const detailEl = document.getElementById('results-detail');
  if (listEl) listEl.style.display = '';
  if (detailEl) detailEl.style.display = 'none';
}

function renderReportDetail(r) {
  let html = '';

  // Header
  html += `<div class="report-detail-header">
    <div class="report-detail-title">${escHtml(r.subject || r.teamName || '')}</div>
    <div class="report-detail-meta">
      <span class="report-detail-team">${escHtml(r.teamName || '')}</span>
      ${r.complexity ? `<span class="mc-plan-complexity standard">${escHtml(r.complexity)}</span>` : ''}
      ${r.duration ? `<span class="report-detail-duration">${escHtml(r.duration)}</span>` : ''}
      <span class="report-detail-date">${r.timestamp ? new Date(r.timestamp).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</span>
    </div>
  </div>`;

  // Team table
  if (r.team && r.team.length) {
    html += `<div class="mc-section"><div class="mc-section-header"><span class="mc-section-title">Team</span></div>`;
    html += '<div class="mc-plan-team">';
    html += '<div class="mc-plan-team-header">Name</div><div class="mc-plan-team-header">Role</div><div class="mc-plan-team-header">Model</div><div class="mc-plan-team-header">St.</div>';
    for (const m of r.team) {
      const icon = (m.status || '').includes('completed') || (m.status || '').includes('SHIP') ? '\u2713' : '\u25CB';
      html += `<div class="mc-plan-team-cell name">${escHtml(m.name)}</div>`;
      html += `<div class="mc-plan-team-cell role">${escHtml(m.role)}</div>`;
      html += `<div class="mc-plan-team-cell model">${escHtml(m.model)}</div>`;
      html += `<div class="mc-plan-team-cell status">${icon}</div>`;
    }
    html += '</div></div>';
  }

  // Steps
  if (r.steps && r.steps.length) {
    html += `<div class="mc-section"><div class="mc-section-header"><span class="mc-section-title">Steps</span><span class="mc-section-badge">${r.steps.length}</span></div>`;
    html += r.steps.map((s, i) => {
      const isDone = (s.status || '').includes('done');
      const cls = isDone ? 'step-done' : 'step-pending';
      const icon = isDone ? '\u2713' : '\u25CB';
      return `<div class="sprint-step-card ${cls}"><div class="step-header"><span class="step-number">S${i + 1}</span><span class="step-status-icon">${icon}</span><span class="step-title">${escHtml(s.step || '')}</span>${s.assignee ? `<span class="role-badge role-worker">${escHtml(s.assignee)}</span>` : ''}</div></div>`;
    }).join('');
    html += '</div>';
  }

  // Checkpoints
  if (r.checkpoints && r.checkpoints.length) {
    html += `<div class="mc-section"><div class="mc-section-header"><span class="mc-section-title">Checkpoints</span></div>`;
    html += '<div class="mc-checkpoints">';
    r.checkpoints.forEach((cp, i) => {
      const cls = cp.done ? 'done' : '';
      const icon = cp.done ? '\u2713' : '\u25CB';
      html += `<div class="checkpoint ${cls}"><span class="checkpoint-icon">${icon}</span><div class="checkpoint-info"><span class="checkpoint-name">${escHtml(cp.name)}</span></div></div>`;
      if (i < r.checkpoints.length - 1) {
        const arrowCls = cp.done ? 'done' : '';
        html += `<div class="checkpoint-arrow-down ${arrowCls}">\u2193</div>`;
      }
    });
    html += '</div></div>';
  }

  // Results summary
  if (r.results) {
    html += `<div class="mc-section"><div class="mc-section-header"><span class="mc-section-title">Results</span></div>`;
    if (r.results.summary) html += `<div class="report-results-summary">${escHtml(r.results.summary)}</div>`;
    if (r.results.details) html += `<div class="report-results-details">${escHtml(r.results.details)}</div>`;
    if (r.results.artifacts && r.results.artifacts.length) {
      html += '<div class="report-results-artifacts">';
      r.results.artifacts.forEach(a => { html += `<span class="tag">${escHtml(a)}</span> `; });
      html += '</div>';
    }
    html += '</div>';
  }

  // Ralph info
  if (r.ralph && r.ralph.enabled) {
    html += `<div class="mc-section"><div class="mc-section-header"><span class="mc-section-title">Ralph Reviews</span></div>`;
    if (r.ralph.verdict) html += `<div class="ralph-card"><div class="ralph-card-header"><span>Overall</span><span class="ralph-card-verdict ${r.ralph.verdict.toLowerCase() === 'ship' ? 'ship' : 'revise'}">${escHtml(r.ralph.verdict)}</span></div></div>`;
    if (r.ralph.iterations) {
      html += '<div style="font-size:12px;color:var(--text-secondary);margin-top:8px">';
      for (const [agent, count] of Object.entries(r.ralph.iterations)) {
        html += `<div>@${escHtml(agent)}: ${count} iteration(s)</div>`;
      }
      html += '</div>';
    }
    html += '</div>';
  }

  // Bulletin excerpt
  if (r.bulletin && r.bulletin.length) {
    html += `<div class="mc-section"><div class="mc-section-header"><span class="mc-section-title">Activity Log</span><span class="mc-section-badge">${r.bulletin.length}</span></div>`;
    html += '<div class="mc-bulletin">';
    r.bulletin.slice(0, 20).forEach(e => {
      html += `<div class="bulletin-entry"><span class="bulletin-time">${escHtml(e.time || '')}</span><span class="bulletin-agent">@${escHtml(e.agent || '')}</span><span class="bulletin-content">${escHtml(e.task || '')} ${escHtml(e.status || '')}</span></div>`;
    });
    html += '</div></div>';
  }

  // Message Log (agent-to-agent conversation log)
  if (r.messageLog && r.messageLog.length) {
    html += `<div class="mc-section"><div class="mc-section-header"><span class="mc-section-title">Message Log</span><span class="mc-section-badge">${r.messageLog.length}</span></div>`;
    html += '<div class="report-message-log">';
    html += '<div class="msg-log-header"><span>Time</span><span>From</span><span></span><span>To</span><span>Type</span><span>Summary</span></div>';
    r.messageLog.forEach(msg => {
      const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
      const typeCls = 'msg-type-' + (msg.type || '').replace(/_/g, '-');
      html += `<div class="msg-log-row">
        <span class="msg-log-time">${escHtml(time)}</span>
        <span class="msg-log-from">@${escHtml(msg.from || '')}</span>
        <span class="msg-log-arrow">&rarr;</span>
        <span class="msg-log-to">@${escHtml(msg.to || '')}</span>
        <span class="msg-log-type ${typeCls}">${escHtml(msg.type || '')}</span>
        <span class="msg-log-summary">${escHtml(msg.summary || '')}</span>
      </div>`;
    });
    html += '</div></div>';
  }

  // Spawn Prompts (collapsible cards per agent)
  if (r.spawnPrompts && r.spawnPrompts.length) {
    html += `<div class="mc-section"><div class="mc-section-header"><span class="mc-section-title">Spawn Prompts</span><span class="mc-section-badge">${r.spawnPrompts.length}</span></div>`;
    html += '<div class="report-spawn-prompts">';
    r.spawnPrompts.forEach(sp => {
      html += `<div class="spawn-prompt-card">
        <div class="spawn-prompt-header" onclick="this.parentElement.classList.toggle('expanded')">
          <span class="spawn-prompt-agent">@${escHtml(sp.agent || '')}</span>
          <span class="spawn-prompt-role">${escHtml(sp.role || '')}</span>
          <span class="spawn-prompt-model">${escHtml(sp.model || '')}</span>
          <span class="spawn-prompt-toggle">&#9660;</span>
        </div>
        <div class="spawn-prompt-body"><pre>${escHtml(sp.prompt || '')}</pre></div>
      </div>`;
    });
    html += '</div></div>';
  }

  return html;
}

// === Init ===

fetchStatus();
connectSSE();

// 15-second polling fallback (supplements SSE for reliability)
setInterval(() => fetchStatus(), 15000);

// P1: Bulletin search event listener
document.addEventListener('DOMContentLoaded', () => {
  const searchEl = document.getElementById('mc-bulletin-search');
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      if (lastKmWorkflow) renderBulletin(lastKmWorkflow);
    });
  }

  // P4: Bootstrap button
  const bootstrapBtn = document.getElementById('btn-team-os-bootstrap');
  if (bootstrapBtn) {
    bootstrapBtn.addEventListener('click', async () => {
      bootstrapBtn.disabled = true;
      bootstrapBtn.textContent = 'Setting up...';
      try {
        const res = await fetch('/api/team-os/bootstrap', { method: 'POST' });
        const result = await res.json();
        if (result.error) {
          alert('Bootstrap failed: ' + result.error);
        } else {
          fetchStatus();
        }
      } catch (e) {
        alert('Bootstrap failed: ' + e.message);
      } finally {
        bootstrapBtn.disabled = false;
        bootstrapBtn.textContent = 'Setup Team OS';
      }
    });
  }

  // Modal close handlers
  const overlay = document.getElementById('modal-overlay');
  const closeBtn = document.getElementById('modal-close');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (overlay) overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // === Mode Toggle (Dashboard / Pixel Office) ===
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (mode === currentMode) return;
      currentMode = mode;

      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const missionControl = document.getElementById('mission-control');
      const pixelOffice = document.getElementById('pixel-office-container');
      const inventoryGrid = document.getElementById('dashboard');
      const resultsContainer = document.getElementById('results-container');

      // Hide all containers first
      missionControl.style.display = 'none';
      inventoryGrid.style.display = 'none';
      pixelOffice.style.display = 'none';
      if (resultsContainer) resultsContainer.style.display = 'none';
      if (typeof PixelOffice !== 'undefined') PixelOffice.stop();

      if (mode === 'pixel') {
        pixelOffice.style.display = 'flex';
        PixelOffice.start();
        if (lastKmWorkflow) {
          PixelOffice.updateAgents(lastKmWorkflow);
          renderPixelWorkflowBar(lastKmWorkflow);
        }
      } else if (mode === 'results') {
        if (resultsContainer) resultsContainer.style.display = '';
        fetchReports();
      } else {
        missionControl.style.display = '';
        inventoryGrid.style.display = '';
      }
    });
  });

  // === Pixel Office Canvas Init ===
  const pixelCanvas = document.getElementById('pixel-office-canvas');
  if (pixelCanvas && typeof PixelOffice !== 'undefined') {
    PixelOffice.init(pixelCanvas);

    // Time-of-day buttons
    document.querySelectorAll('.pixel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pixel-btn').forEach(b => b.classList.remove('pixel-btn-active'));
        btn.classList.add('pixel-btn-active');
        PixelOffice.setTimeOfDay(btn.dataset.time);
      });
    });
  }
});
