/**
 * SourceTree JSON - Tree Graph Visualization
 * JSON Crack-style hierarchical graph with compact node cards
 * 
 * Key features:
 * - Compact cards showing multiple key-value pairs per node
 * - Objects/Arrays as parent nodes with children
 * - Bezier curve connections
 * - Pan and zoom
 * - Collapse/expand nodes
 */

(function(global) {
  'use strict';

  class TreeGraph {
    constructor(container, data) {
      this.container = container;
      this.data = data;
      this.nodes = [];
      this.edges = [];
      this.nodeId = 0;
      
      // Layout configuration
      this.config = {
        nodeWidth: 200,
        nodeMinHeight: 32,
        rowHeight: 22,
        nodePadding: 8,
        horizontalGap: 100,
        verticalGap: 16,
        startX: 40,
        startY: 40,
        maxRowsPerNode: 20
      };
      
      // Viewport state
      this.viewport = {
        x: 0,
        y: 0,
        scale: 1
      };
      
      // Interaction state
      this.isPanning = false;
      this.panStart = { x: 0, y: 0 };
      this.selectedNode = null;
      
      this.init();
    }

    init() {
      this.setupContainer();
      this.buildNodeTree(this.data, null, 'root', '');
      this.calculateLayout();
      this.render();
      this.setupEventListeners();
      this.fitToView();
    }

    setupContainer() {
      this.container.innerHTML = '';
      this.container.style.cssText = `
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        cursor: grab;
      `;
      
      // SVG layer for edges
      this.svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.svgLayer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: visible;
      `;
      this.container.appendChild(this.svgLayer);
      
      // Wrapper for transform
      this.wrapper = document.createElement('div');
      this.wrapper.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        transform-origin: 0 0;
      `;
      this.container.appendChild(this.wrapper);
      
      // Node container
      this.nodeContainer = document.createElement('div');
      this.nodeContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
      `;
      this.wrapper.appendChild(this.nodeContainer);
      
      // Edge container (inside wrapper for transform)
      this.edgeContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.edgeContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 10000px;
        height: 10000px;
        pointer-events: none;
        overflow: visible;
      `;
      this.wrapper.insertBefore(this.edgeContainer, this.nodeContainer);
    }

    /**
     * Build node tree from JSON data
     * Creates compact card nodes like JSON Crack
     */
    buildNodeTree(data, parentNode, key, path) {
      const type = this.getType(data);
      const id = this.nodeId++;
      
      const node = {
        id: id,
        key: key,
        path: path || key,
        type: type,
        data: data,
        parent: parentNode,
        children: [],
        collapsed: false,
        x: 0,
        y: 0,
        width: this.config.nodeWidth,
        height: 0,
        rows: []
      };
      
      // Build rows for this node (JSON Crack style - compact)
      if (type === 'object' && data !== null) {
        const entries = Object.entries(data);
        entries.forEach(([k, v]) => {
          const vType = this.getType(v);
          if (vType === 'object' || vType === 'array') {
            // Complex value - create child node
            const childPath = path ? `${path}.${k}` : k;
            const childNode = this.buildNodeTree(v, node, k, childPath);
            node.children.push({ key: k, node: childNode });
          } else {
            // Primitive value - add as row
            node.rows.push({ key: k, value: v, type: vType });
          }
        });
      } else if (type === 'array') {
        data.forEach((item, i) => {
          const vType = this.getType(item);
          const childPath = path ? `${path}[${i}]` : `[${i}]`;
          if (vType === 'object' || vType === 'array') {
            const childNode = this.buildNodeTree(item, node, `[${i}]`, childPath);
            node.children.push({ key: `[${i}]`, node: childNode });
          } else {
            node.rows.push({ key: `${i}`, value: item, type: vType });
          }
        });
      } else {
        // Root is primitive
        node.rows.push({ key: key, value: data, type: type });
      }
      
      // Calculate node height
      const rowCount = Math.min(node.rows.length, this.config.maxRowsPerNode);
      const hasMoreRows = node.rows.length > this.config.maxRowsPerNode;
      const hasChildren = node.children.length > 0;
      
      let height = this.config.nodePadding * 2;
      if (rowCount > 0) {
        height += rowCount * this.config.rowHeight;
        if (hasMoreRows) height += this.config.rowHeight; // For "... more" row
      }
      if (hasChildren) {
        height += node.children.length * this.config.rowHeight;
      }
      height = Math.max(height, this.config.nodeMinHeight);
      node.height = height;
      
      this.nodes.push(node);
      return node;
    }

    getType(value) {
      if (value === null) return 'null';
      if (Array.isArray(value)) return 'array';
      return typeof value;
    }

    /**
     * Calculate layout positions using tree algorithm
     */
    calculateLayout() {
      const root = this.nodes.find(n => n.parent === null);
      if (!root) return;
      
      this.calculateSubtreeSize(root);
      this.positionNode(root, this.config.startX, this.config.startY);
      this.buildEdges();
    }

    calculateSubtreeSize(node) {
      if (node.collapsed || node.children.length === 0) {
        node.subtreeHeight = node.height;
        return node.subtreeHeight;
      }
      
      let totalHeight = 0;
      node.children.forEach((child, i) => {
        totalHeight += this.calculateSubtreeSize(child.node);
        if (i < node.children.length - 1) {
          totalHeight += this.config.verticalGap;
        }
      });
      
      node.subtreeHeight = Math.max(node.height, totalHeight);
      return node.subtreeHeight;
    }

    positionNode(node, x, y) {
      node.x = x;
      node.y = y + (node.subtreeHeight - node.height) / 2;
      
      if (node.collapsed || node.children.length === 0) return;
      
      let childY = y;
      const childX = x + node.width + this.config.horizontalGap;
      
      node.children.forEach((child) => {
        this.positionNode(child.node, childX, childY);
        childY += child.node.subtreeHeight + this.config.verticalGap;
      });
    }

    buildEdges() {
      this.edges = [];
      this.nodes.forEach(node => {
        if (node.collapsed) return;
        node.children.forEach((child, index) => {
          this.edges.push({
            from: node,
            to: child.node,
            fromIndex: index,
            key: child.key
          });
        });
      });
    }

    /**
     * Render all nodes and edges
     */
    render() {
      this.renderEdges();
      this.renderNodes();
      this.updateTransform();
    }

    renderNodes() {
      this.nodeContainer.innerHTML = '';
      
      this.nodes.forEach(node => {
        if (!this.isNodeVisible(node)) return;
        
        const el = this.createNodeElement(node);
        this.nodeContainer.appendChild(el);
      });
    }

    createNodeElement(node) {
      const el = document.createElement('div');
      el.className = `graph-node ${node === this.selectedNode ? 'selected' : ''}`;
      el.dataset.nodeId = node.id;
      el.style.cssText = `
        position: absolute;
        left: ${node.x}px;
        top: ${node.y}px;
        width: ${node.width}px;
        min-height: ${node.height}px;
        background: var(--node-bg, #1a1a2e);
        border: 1px solid var(--node-border, #2d2d44);
        border-radius: 6px;
        font-family: 'JetBrains Mono', ui-monospace, 'Menlo', monospace;
        font-size: 14.4px;
        overflow: hidden;
        cursor: pointer;
        user-select: none;
      `;
      
      // Render rows (primitive values)
      const displayRows = node.rows.slice(0, this.config.maxRowsPerNode);
      const hasMoreRows = node.rows.length > this.config.maxRowsPerNode;
      
      displayRows.forEach(row => {
        el.appendChild(this.createRowElement(row));
      });
      
      if (hasMoreRows) {
        const moreRow = document.createElement('div');
        moreRow.className = 'node-row more-row';
        moreRow.style.cssText = `
          padding: 2px 10px;
          color: #666;
          font-style: italic;
          font-size: 13.2px;
        `;
        moreRow.textContent = `... ${node.rows.length - this.config.maxRowsPerNode} more`;
        el.appendChild(moreRow);
      }
      
      // Render child links
      node.children.forEach((child, index) => {
        const linkRow = this.createChildLinkRow(child, node, index);
        el.appendChild(linkRow);
      });
      
      // Event listeners
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectNode(node);
      });
      
      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (node.children.length > 0) {
          this.toggleCollapse(node);
        }
      });
      
      return el;
    }

    createRowElement(row) {
      const el = document.createElement('div');
      el.className = 'node-row';
      el.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 2px 10px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        gap: 8px;
      `;
      
      const keyEl = document.createElement('span');
      keyEl.className = 'row-key';
      keyEl.style.cssText = `
        color: #888;
        flex-shrink: 0;
        max-width: 80px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `;
      keyEl.textContent = row.key;
      
      const valueEl = document.createElement('span');
      valueEl.className = `row-value type-${row.type}`;
      valueEl.style.cssText = `
        color: ${this.getTypeColor(row.type)};
        flex: 1;
        text-align: right;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `;
      
      // Format value
      let displayValue = this.formatValue(row.value, row.type);
      valueEl.textContent = displayValue;
      
      // Color preview for hex colors
      if (row.type === 'string' && /^#[0-9A-Fa-f]{6}$/.test(row.value)) {
        const colorDot = document.createElement('span');
        colorDot.style.cssText = `
          display: inline-block;
          width: 10px;
          height: 10px;
          background: ${row.value};
          border-radius: 2px;
          margin-right: 4px;
          vertical-align: middle;
        `;
        valueEl.insertBefore(colorDot, valueEl.firstChild);
      }
      
      el.appendChild(keyEl);
      el.appendChild(valueEl);
      
      return el;
    }

    createChildLinkRow(child, parentNode, index) {
      const el = document.createElement('div');
      el.className = 'node-row child-link';
      el.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 2px 10px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        cursor: pointer;
      `;
      
      // Collapse indicator
      const collapseBtn = document.createElement('span');
      collapseBtn.className = 'collapse-btn';
      collapseBtn.style.cssText = `
        color: #555;
        font-size: 12px;
        margin-right: 6px;
        transition: transform 0.2s;
      `;
      collapseBtn.textContent = parentNode.collapsed ? '▶' : '▼';
      
      const keyEl = document.createElement('span');
      keyEl.className = 'row-key';
      keyEl.style.cssText = `
        color: #e0e0e0;
        flex: 1;
      `;
      keyEl.textContent = child.key;
      
      const typeEl = document.createElement('span');
      typeEl.className = 'row-type';
      const childType = this.getType(child.node.data);
      const count = childType === 'array' ? child.node.data.length : Object.keys(child.node.data || {}).length;
      typeEl.style.cssText = `
        color: ${this.getTypeColor(childType)};
        font-size: 13.2px;
      `;
      typeEl.textContent = childType === 'array' ? `[${count}]` : `{${count}}`;
      
      el.appendChild(collapseBtn);
      el.appendChild(keyEl);
      el.appendChild(typeEl);
      
      // Click to collapse
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleCollapse(parentNode);
      });
      
      return el;
    }

    renderEdges() {
      this.edgeContainer.innerHTML = '';
      
      this.edges.forEach(edge => {
        if (!this.isNodeVisible(edge.to)) return;
        
        const path = this.createEdgePath(edge);
        this.edgeContainer.appendChild(path);
      });
    }

    createEdgePath(edge) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      
      // Calculate connection points
      const fromNode = edge.from;
      const toNode = edge.to;
      
      // From: right side of parent, aligned to child link row
      const rowOffset = fromNode.rows.slice(0, this.config.maxRowsPerNode).length;
      const hasMoreRows = fromNode.rows.length > this.config.maxRowsPerNode;
      const rowIndex = rowOffset + (hasMoreRows ? 1 : 0) + edge.fromIndex;
      
      const fromX = fromNode.x + fromNode.width;
      const fromY = fromNode.y + this.config.nodePadding + (rowIndex * this.config.rowHeight) + this.config.rowHeight / 2;
      
      // To: left side of child, vertically centered
      const toX = toNode.x;
      const toY = toNode.y + toNode.height / 2;
      
      // Bezier curve
      const midX = fromX + (toX - fromX) * 0.5;
      const d = `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
      
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#3d3d5c');
      path.setAttribute('stroke-width', '2');
      
      return path;
    }

    getTypeColor(type) {
      const colors = {
        string: '#98c379',
        number: '#61afef',
        boolean: '#e5c07b',
        null: '#636d83',
        object: '#c678dd',
        array: '#56b6c2'
      };
      return colors[type] || '#abb2bf';
    }

    formatValue(value, type) {
      if (type === 'null') return 'null';
      if (type === 'boolean') return value ? 'true' : 'false';
      if (type === 'string') {
        if (value.length > 25) return `"${value.substring(0, 22)}..."`;
        return `"${value}"`;
      }
      if (type === 'number') return String(value);
      return String(value);
    }

    isNodeVisible(node) {
      let current = node.parent;
      while (current) {
        if (current.collapsed) return false;
        current = current.parent;
      }
      return true;
    }

    selectNode(node) {
      this.selectedNode = node;
      this.render();
      
      const event = new CustomEvent('nodeselected', { 
        detail: {
          node: node,
          path: node.path,
          type: node.type,
          data: node.data
        }
      });
      this.container.dispatchEvent(event);
    }

    toggleCollapse(node) {
      node.collapsed = !node.collapsed;
      this.calculateLayout();
      this.render();
    }

    expandAll() {
      this.nodes.forEach(n => n.collapsed = false);
      this.calculateLayout();
      this.render();
    }

    collapseAll() {
      this.nodes.forEach(n => {
        if (n.children.length > 0 && n.parent !== null) {
          n.collapsed = true;
        }
      });
      this.calculateLayout();
      this.render();
    }

    /**
     * Event listeners for pan/zoom
     */
    setupEventListeners() {
      // Pan
      this.container.addEventListener('mousedown', (e) => {
        if (e.target === this.container || e.target === this.edgeContainer || e.target === this.wrapper) {
          this.isPanning = true;
          this.panStart = {
            x: e.clientX - this.viewport.x,
            y: e.clientY - this.viewport.y
          };
          this.container.style.cursor = 'grabbing';
        }
      });
      
      document.addEventListener('mousemove', (e) => {
        if (this.isPanning) {
          this.viewport.x = e.clientX - this.panStart.x;
          this.viewport.y = e.clientY - this.panStart.y;
          this.updateTransform();
        }
      });
      
      document.addEventListener('mouseup', () => {
        this.isPanning = false;
        this.container.style.cursor = 'grab';
      });
      
      // Zoom
      this.container.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        const rect = this.container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.1, Math.min(3, this.viewport.scale * delta));
        
        // Zoom toward mouse position
        const scaleChange = newScale / this.viewport.scale;
        this.viewport.x = mouseX - scaleChange * (mouseX - this.viewport.x);
        this.viewport.y = mouseY - scaleChange * (mouseY - this.viewport.y);
        this.viewport.scale = newScale;
        
        this.updateTransform();
      }, { passive: false });
      
      // Deselect on background click
      this.container.addEventListener('click', (e) => {
        if (e.target === this.container || e.target === this.wrapper) {
          this.selectedNode = null;
          this.render();
          this.container.dispatchEvent(new CustomEvent('nodedeselected'));
        }
      });
    }

    updateTransform() {
      const transform = `translate(${this.viewport.x}px, ${this.viewport.y}px) scale(${this.viewport.scale})`;
      this.wrapper.style.transform = transform;
    }

    fitToView() {
      if (this.nodes.length === 0) return;
      
      // Find bounds
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      this.nodes.forEach(node => {
        if (!this.isNodeVisible(node)) return;
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
      });
      
      const contentWidth = maxX - minX + 80;
      const contentHeight = maxY - minY + 80;
      
      const containerRect = this.container.getBoundingClientRect();
      
      // Calculate scale to fit
      const scaleX = containerRect.width / contentWidth;
      const scaleY = containerRect.height / contentHeight;
      this.viewport.scale = Math.min(scaleX, scaleY, 1);
      
      // Center content
      this.viewport.x = (containerRect.width - contentWidth * this.viewport.scale) / 2 - minX * this.viewport.scale + 40;
      this.viewport.y = (containerRect.height - contentHeight * this.viewport.scale) / 2 - minY * this.viewport.scale + 40;
      
      this.updateTransform();
    }

    zoomIn() {
      this.viewport.scale = Math.min(3, this.viewport.scale * 1.2);
      this.updateTransform();
    }

    zoomOut() {
      this.viewport.scale = Math.max(0.1, this.viewport.scale * 0.8);
      this.updateTransform();
    }

    resetView() {
      this.fitToView();
    }

    // Search for node by path
    findNode(path) {
      return this.nodes.find(n => n.path === path);
    }

    // Focus on specific node
    focusNode(node) {
      if (!node) return;
      
      // Expand parents
      let current = node.parent;
      while (current) {
        current.collapsed = false;
        current = current.parent;
      }
      
      this.calculateLayout();
      this.render();
      
      // Center on node
      const containerRect = this.container.getBoundingClientRect();
      this.viewport.x = containerRect.width / 2 - (node.x + node.width / 2) * this.viewport.scale;
      this.viewport.y = containerRect.height / 2 - (node.y + node.height / 2) * this.viewport.scale;
      this.updateTransform();
      
      this.selectNode(node);
    }
  }

  // Export
  global.TreeGraph = TreeGraph;

})(window);
