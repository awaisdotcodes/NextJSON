/**
 * SourceTree JSON - UI Renderer
 * Converts JSON data to interactive UI views
 * Views: Card, Form, Table, Dashboard, Timeline, Profile
 */

(function(global) {
  'use strict';

  class UIRenderer {
    constructor(container, data) {
      this.container = container;
      this.data = data;
      this.currentView = 'card';
      this.detectedType = this.detectDataType(data);
      
      this.init();
    }

    init() {
      this.container.innerHTML = '';
      this.render();
    }

    detectDataType(data) {
      const unwrapped = this.unwrap(data);
      const flat = this.flatten(unwrapped);
      const keys = Object.keys(flat).map(k => k.toLowerCase());
      
      // Product detection
      if (keys.some(k => k.includes('price') || k.includes('product') || k.includes('sku'))) {
        return { type: 'product', icon: '🛍️', label: 'Product Data' };
      }
      
      // User/Profile detection
      if (keys.some(k => k.includes('email') || k.includes('username') || k.includes('avatar'))) {
        return { type: 'user', icon: '👤', label: 'User Profile' };
      }
      
      // Order detection
      if (keys.some(k => k.includes('order') || k.includes('shipping') || k.includes('billing'))) {
        return { type: 'order', icon: '📦', label: 'Order Data' };
      }
      
      // Event/Timeline detection
      if (keys.some(k => k.includes('date') || k.includes('event') || k.includes('created'))) {
        return { type: 'event', icon: '📅', label: 'Event Data' };
      }
      
      // Array/List detection
      if (Array.isArray(unwrapped)) {
        return { type: 'list', icon: '📋', label: 'List Data' };
      }
      
      return { type: 'generic', icon: '📄', label: 'JSON Data' };
    }

    render() {
      const views = this.getAvailableViews();
      
      this.container.innerHTML = `
        <div class="ui-renderer">
          <div class="ui-header">
            <div class="ui-detected-type">
              <span class="ui-type-icon">${this.detectedType.icon}</span>
              <span>${this.detectedType.label}</span>
            </div>
            <div class="ui-view-tabs">
              ${views.map(v => `
                <button class="ui-view-tab ${v.id === this.currentView ? 'active' : ''}" data-view="${v.id}">
                  <span>${v.icon}</span>
                  <span>${v.label}</span>
                </button>
              `).join('')}
            </div>
          </div>
          <div class="ui-content"></div>
        </div>
      `;
      
      // Setup tab listeners
      this.container.querySelectorAll('.ui-view-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          this.currentView = tab.dataset.view;
          this.container.querySelectorAll('.ui-view-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          this.renderCurrentView();
        });
      });
      
      this.renderCurrentView();
    }

    getAvailableViews() {
      return [
        { id: 'card', icon: '🎴', label: 'Card' },
        { id: 'form', icon: '📝', label: 'Form' },
        { id: 'table', icon: '📊', label: 'Table' },
        { id: 'dashboard', icon: '📈', label: 'Dashboard' },
        { id: 'timeline', icon: '📅', label: 'Timeline' },
        { id: 'profile', icon: '👤', label: 'Profile' }
      ];
    }

    renderCurrentView() {
      const content = this.container.querySelector('.ui-content');
      
      switch (this.currentView) {
        case 'card':
          this.renderCardView(content);
          break;
        case 'form':
          this.renderFormView(content);
          break;
        case 'table':
          this.renderTableView(content);
          break;
        case 'dashboard':
          this.renderDashboardView(content);
          break;
        case 'timeline':
          this.renderTimelineView(content);
          break;
        case 'profile':
          this.renderProfileView(content);
          break;
        default:
          this.renderCardView(content);
      }
    }

    // ============================================
    // CARD VIEW
    // ============================================
    renderCardView(container) {
      const data = this.unwrap(this.data);
      const flat = this.flatten(data);
      
      // Find key fields
      const title = this.findField(flat, ['title', 'name', 'product_name', 'item_name']) || 'Item';
      const subtitle = this.findField(flat, ['vendor', 'brand', 'author', 'category', 'type']);
      const price = this.findNumberField(flat, ['price', 'amount', 'cost', 'total']);
      const comparePrice = this.findNumberField(flat, ['compare_at_price', 'original_price', 'msrp']);
      const image = this.findImageUrl(data);
      const description = this.findField(flat, ['description', 'body', 'content', 'summary']);
      const status = this.findField(flat, ['status', 'availability', 'stock_status']);
      const quantity = this.findNumberField(flat, ['quantity', 'inventory_quantity', 'stock', 'in_stock']);
      const tags = this.findArrayField(data, ['tags', 'categories', 'labels']);
      
      // Calculate discount
      let discount = null;
      if (price && comparePrice && comparePrice > price) {
        discount = Math.round((1 - price / comparePrice) * 100);
      }
      
      container.innerHTML = `
        <div class="ui-card-view">
          <div class="ui-product-card">
            <div class="ui-card-image-container">
              ${discount ? `<div class="ui-card-badge">-${discount}%</div>` : ''}
              ${image 
                ? `<img src="${this.escapeHtml(this.safeUrl(image))}" class="ui-card-image" onerror="this.parentElement.innerHTML='<div class=\\'ui-no-image\\'>📷</div>'">`
                : '<div class="ui-no-image">📷</div>'
              }
            </div>
            <div class="ui-card-details">
              ${subtitle ? `<div class="ui-card-vendor">${this.escapeHtml(subtitle)}</div>` : ''}
              <div class="ui-card-title">${this.escapeHtml(title)}</div>
              ${tags && tags.length ? `
                <div class="ui-card-tags">
                  ${tags.slice(0, 3).map(t => `<span class="ui-card-tag">${this.escapeHtml(t)}</span>`).join('')}
                </div>
              ` : ''}
              ${price !== null ? `
                <div class="ui-card-price-section">
                  <span class="ui-current-price">${this.formatCurrency(price)}</span>
                  ${comparePrice && comparePrice > price ? `<span class="ui-original-price">${this.formatCurrency(comparePrice)}</span>` : ''}
                  ${discount ? `<span class="ui-discount-badge">Save ${discount}%</span>` : ''}
                </div>
              ` : ''}
              ${quantity !== null ? `
                <div class="ui-stock-status ${quantity < 10 ? (quantity === 0 ? 'out' : 'low') : ''}">
                  <span class="ui-stock-dot"></span>
                  <span>${quantity === 0 ? 'Out of Stock' : quantity < 10 ? `Only ${quantity} left` : `${quantity} in stock`}</span>
                </div>
              ` : ''}
              ${description ? `<div class="ui-card-description">${this.escapeHtml(description.substring(0, 150))}${description.length > 150 ? '...' : ''}</div>` : ''}
              <div class="ui-card-actions">
                <button class="ui-btn ui-btn-primary">View Details</button>
                <button class="ui-btn ui-btn-secondary">Share</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // ============================================
    // FORM VIEW
    // ============================================
    renderFormView(container) {
      const data = this.unwrap(this.data);
      const flat = this.flatten(data);
      const sections = this.groupBySection(flat);
      
      let html = '<div class="ui-form-view">';
      
      for (const [section, fields] of Object.entries(sections)) {
        html += `
          <div class="ui-form-section">
            <div class="ui-form-section-title">${this.escapeHtml(section)}</div>
            ${fields.map(f => this.renderFormField(f)).join('')}
          </div>
        `;
      }
      
      html += '</div>';
      container.innerHTML = html;
      
      // Add toggle functionality
      container.querySelectorAll('.ui-toggle-switch').forEach(toggle => {
        toggle.addEventListener('click', () => toggle.classList.toggle('active'));
      });
    }

    renderFormField(field) {
      const { key, value, type } = field;
      const label = key.split('.').pop().replace(/_/g, ' ');
      
      if (type === 'boolean') {
        return `
          <div class="ui-form-toggle-row">
            <span class="ui-form-label">${this.escapeHtml(this.capitalize(label))}</span>
            <div class="ui-toggle-switch ${value ? 'active' : ''}" data-key="${this.escapeHtml(key)}"></div>
          </div>
        `;
      }
      
      if (type === 'image') {
        return `
          <div class="ui-form-group">
            <label class="ui-form-label">${this.escapeHtml(this.capitalize(label))}</label>
            <div class="ui-image-preview-box">
              <img src="${this.escapeHtml(this.safeUrl(value))}" onerror="this.parentElement.innerHTML='No image'">
            </div>
          </div>
        `;
      }
      
      const inputType = type === 'number' ? 'number' : type === 'email' ? 'email' : 'text';
      const isLongText = typeof value === 'string' && value.length > 100;
      
      if (isLongText) {
        return `
          <div class="ui-form-group">
            <label class="ui-form-label">${this.escapeHtml(this.capitalize(label))}</label>
            <textarea class="ui-form-textarea" data-key="${this.escapeHtml(key)}">${this.escapeHtml(String(value ?? ''))}</textarea>
          </div>
        `;
      }
      
      return `
        <div class="ui-form-group">
          <label class="ui-form-label">${this.escapeHtml(this.capitalize(label))}</label>
          <input type="${inputType}" class="ui-form-input" value="${this.escapeHtml(String(value ?? ''))}" data-key="${this.escapeHtml(key)}">
        </div>
      `;
    }

    groupBySection(flat) {
      const sections = {};
      
      for (const [key, value] of Object.entries(flat)) {
        const parts = key.split('.');
        const section = parts.length > 1 ? this.capitalize(parts[0].replace(/_/g, ' ')) : 'General';
        
        if (!sections[section]) sections[section] = [];
        
        let type = typeof value;
        if (value === null) type = 'null';
        else if (this.isUrl(value) && (key.includes('image') || key.includes('src') || key.includes('avatar'))) type = 'image';
        else if (type === 'string' && this.isUrl(value)) type = 'url';
        
        sections[section].push({ key, value, type });
      }
      
      return sections;
    }

    // ============================================
    // TABLE VIEW
    // ============================================
    renderTableView(container) {
      const data = this.unwrap(this.data);
      let arrayData = [];
      
      if (Array.isArray(data)) {
        arrayData = data;
      } else {
        for (const value of Object.values(data)) {
          if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
            arrayData = value;
            break;
          }
        }
      }
      
      if (arrayData.length === 0) {
        const flat = this.flatten(data);
        arrayData = [flat];
      }
      
      const allKeys = [...new Set(arrayData.flatMap(item => Object.keys(this.flatten(item))))];
      const displayKeys = allKeys.slice(0, 8);
      
      container.innerHTML = `
        <div class="ui-table-container">
          <div class="ui-table-header-bar">
            <span class="ui-table-title">📊 Data Table</span>
            <span class="ui-table-count">${arrayData.length} items</span>
          </div>
          <div class="ui-table-wrapper">
            <table class="ui-data-table">
              <thead>
                <tr>
                  ${displayKeys.map(k => `<th>${this.escapeHtml(this.capitalize(k.split('.').pop().replace(/_/g, ' ')))}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${arrayData.slice(0, 50).map(item => {
                  const flat = this.flatten(item);
                  return `
                    <tr>
                      ${displayKeys.map(k => `<td>${this.formatTableValue(flat[k])}</td>`).join('')}
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          ${arrayData.length > 50 ? `<div class="ui-table-more">Showing 50 of ${arrayData.length} items</div>` : ''}
        </div>
      `;
    }

    formatTableValue(value) {
      if (value === null || value === undefined) return '<span class="ui-null">—</span>';
      if (typeof value === 'boolean') return value ? '<span class="ui-bool-true">✓</span>' : '<span class="ui-bool-false">✗</span>';
      if (typeof value === 'string' && this.isUrl(value)) {
        if (value.match(/\.(jpg|jpeg|png|gif|webp)/i)) {
          return `<img src="${this.escapeHtml(this.safeUrl(value))}" class="ui-table-img" onerror="this.outerHTML='🖼️'">`;
        }
        return '<span class="ui-link">🔗 Link</span>';
      }
      const str = String(value);
      return this.escapeHtml(str.length > 50 ? str.substring(0, 50) + '...' : str);
    }

    // ============================================
    // DASHBOARD VIEW
    // ============================================
    renderDashboardView(container) {
      const data = this.unwrap(this.data);
      const flat = this.flatten(data);
      const stats = this.extractStats(flat);
      const typeCount = this.countTypes(flat);
      
      let html = '<div class="ui-dashboard">';
      html += '<div class="ui-dashboard-grid">';
      
      for (const stat of stats) {
        html += `
          <div class="ui-stat-card ${stat.highlight ? 'highlight' : ''}">
            <div class="ui-stat-label">${this.escapeHtml(stat.label)}</div>
            <div class="ui-stat-value">${this.escapeHtml(String(stat.value))}</div>
          </div>
        `;
      }
      
      html += '</div>';
      
      // Data summary
      html += `
        <div class="ui-summary-card">
          <div class="ui-summary-title">Data Summary</div>
          <div class="ui-summary-grid">
            <div class="ui-summary-item">
              <span class="ui-summary-value" style="color:#61afef">${typeCount.numbers}</span>
              <span class="ui-summary-label">Numbers</span>
            </div>
            <div class="ui-summary-item">
              <span class="ui-summary-value" style="color:#98c379">${typeCount.strings}</span>
              <span class="ui-summary-label">Strings</span>
            </div>
            <div class="ui-summary-item">
              <span class="ui-summary-value" style="color:#e5c07b">${typeCount.booleans}</span>
              <span class="ui-summary-label">Booleans</span>
            </div>
            <div class="ui-summary-item">
              <span class="ui-summary-value" style="color:#636d83">${typeCount.nulls}</span>
              <span class="ui-summary-label">Nulls</span>
            </div>
          </div>
        </div>
      `;
      
      html += '</div>';
      container.innerHTML = html;
    }

    extractStats(flat) {
      const stats = [];
      
      for (const [key, value] of Object.entries(flat)) {
        const label = key.split('.').pop().replace(/_/g, ' ');
        
        if (typeof value === 'number') {
          if (key.toLowerCase().includes('price') || key.toLowerCase().includes('total') || key.toLowerCase().includes('amount')) {
            stats.unshift({ label: this.capitalize(label), value: this.formatCurrency(value), highlight: true });
          } else if (key.toLowerCase().includes('quantity') || key.toLowerCase().includes('stock') || key.toLowerCase().includes('inventory') || key.toLowerCase().includes('count')) {
            stats.push({ label: this.capitalize(label), value: value.toLocaleString(), highlight: false });
          }
        }
      }
      
      stats.push({ label: 'Total Fields', value: Object.keys(flat).length.toString(), highlight: false });
      
      return stats.slice(0, 8);
    }

    countTypes(flat) {
      const counts = { numbers: 0, strings: 0, booleans: 0, nulls: 0 };
      for (const value of Object.values(flat)) {
        if (value === null) counts.nulls++;
        else if (typeof value === 'number') counts.numbers++;
        else if (typeof value === 'string') counts.strings++;
        else if (typeof value === 'boolean') counts.booleans++;
      }
      return counts;
    }

    // ============================================
    // TIMELINE VIEW
    // ============================================
    renderTimelineView(container) {
      const data = this.unwrap(this.data);
      const flat = this.flatten(data);
      const events = [];
      
      for (const [key, value] of Object.entries(flat)) {
        if (this.isDate(value)) {
          events.push({
            label: this.capitalize(key.split('.').pop().replace(/_/g, ' ')),
            date: value,
            formatted: this.formatDate(value)
          });
        }
      }
      
      events.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      if (events.length === 0) {
        container.innerHTML = `
          <div class="ui-empty-state">
            <div class="ui-empty-icon">📅</div>
            <div class="ui-empty-title">No Timeline Data</div>
            <div class="ui-empty-text">No date fields found in this JSON</div>
          </div>
        `;
        return;
      }
      
      container.innerHTML = `
        <div class="ui-timeline">
          ${events.map((event, i) => `
            <div class="ui-timeline-item">
              <div class="ui-timeline-marker"></div>
              <div class="ui-timeline-content">
                <div class="ui-timeline-date">${this.escapeHtml(event.formatted)}</div>
                <div class="ui-timeline-label">${this.escapeHtml(event.label)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // ============================================
    // PROFILE VIEW
    // ============================================
    renderProfileView(container) {
      const data = this.unwrap(this.data);
      const flat = this.flatten(data);
      
      const name = this.findField(flat, ['name', 'full_name', 'username', 'display_name', 'title']) || 'Unknown';
      const email = this.findField(flat, ['email', 'email_address', 'mail']);
      const phone = this.findField(flat, ['phone', 'phone_number', 'mobile', 'telephone']);
      const avatar = this.findImageUrl(data);
      const bio = this.findField(flat, ['bio', 'description', 'about', 'summary']);
      const location = this.findField(flat, ['location', 'address', 'city', 'country']);
      const website = this.findField(flat, ['website', 'url', 'homepage']);
      const role = this.findField(flat, ['role', 'job_title', 'position', 'occupation']);
      const company = this.findField(flat, ['company', 'organization', 'employer']);
      
      container.innerHTML = `
        <div class="ui-profile-view">
          <div class="ui-profile-card">
            <div class="ui-profile-header">
              <div class="ui-profile-avatar">
                ${avatar 
                  ? `<img src="${this.escapeHtml(this.safeUrl(avatar))}" onerror="this.outerHTML='<span class=\\'ui-avatar-placeholder\\'>👤</span>'">`
                  : '<span class="ui-avatar-placeholder">👤</span>'
                }
              </div>
              <div class="ui-profile-info">
                <div class="ui-profile-name">${this.escapeHtml(name)}</div>
                ${role ? `<div class="ui-profile-role">${this.escapeHtml(role)}${company ? ` at ${this.escapeHtml(company)}` : ''}</div>` : ''}
                ${location ? `<div class="ui-profile-location">📍 ${this.escapeHtml(location)}</div>` : ''}
              </div>
            </div>
            ${bio ? `<div class="ui-profile-bio">${this.escapeHtml(bio)}</div>` : ''}
            <div class="ui-profile-details">
              ${email ? `
                <div class="ui-profile-detail">
                  <span class="ui-detail-icon">✉️</span>
                  <span>${this.escapeHtml(email)}</span>
                </div>
              ` : ''}
              ${phone ? `
                <div class="ui-profile-detail">
                  <span class="ui-detail-icon">📱</span>
                  <span>${this.escapeHtml(phone)}</span>
                </div>
              ` : ''}
              ${website ? `
                <div class="ui-profile-detail">
                  <span class="ui-detail-icon">🌐</span>
                  <a href="${this.escapeHtml(this.safeUrl(website))}" target="_blank" rel="noopener">${this.escapeHtml(website)}</a>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }

    // ============================================
    // UTILITY METHODS
    // ============================================
    unwrap(data) {
      if (!data || typeof data !== 'object') return data;
      const keys = Object.keys(data);
      if (keys.length === 1 && typeof data[keys[0]] === 'object' && !Array.isArray(data[keys[0]])) {
        return data[keys[0]];
      }
      return data;
    }

    flatten(obj, prefix = '') {
      const result = {};
      
      if (!obj || typeof obj !== 'object') return result;
      
      for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          Object.assign(result, this.flatten(value, newKey));
        } else if (Array.isArray(value)) {
          if (value.length > 0 && typeof value[0] !== 'object') {
            result[newKey] = value.join(', ');
          }
        } else {
          result[newKey] = value;
        }
      }
      
      return result;
    }

    findField(flat, keys) {
      for (const k of keys) {
        for (const [key, value] of Object.entries(flat)) {
          if (key.toLowerCase().includes(k) && value) {
            return value;
          }
        }
      }
      return null;
    }

    findNumberField(flat, keys) {
      for (const k of keys) {
        for (const [key, value] of Object.entries(flat)) {
          if (key.toLowerCase().includes(k) && typeof value === 'number') {
            return value;
          }
        }
      }
      return null;
    }

    findArrayField(obj, keys) {
      for (const k of keys) {
        for (const [key, value] of Object.entries(obj)) {
          if (key.toLowerCase().includes(k) && Array.isArray(value)) {
            return value;
          }
        }
      }
      return null;
    }

    findImageUrl(obj) {
      const check = (o) => {
        for (const [key, value] of Object.entries(o)) {
          if (typeof value === 'string' && this.isUrl(value) && value.match(/\.(jpg|jpeg|png|gif|webp)/i)) {
            return value;
          }
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            const found = check(value);
            if (found) return found;
          }
          if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
            const found = check(value[0]);
            if (found) return found;
          }
        }
        return null;
      };
      return check(obj);
    }

    isUrl(str) {
      if (typeof str !== 'string') return false;
      return str.startsWith('http://') || str.startsWith('https://');
    }

    isDate(str) {
      if (typeof str !== 'string') return false;
      return /^\d{4}-\d{2}-\d{2}/.test(str);
    }

    formatDate(str) {
      try {
        const date = new Date(str);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch {
        return str;
      }
    }

    formatCurrency(amount, currency = 'USD') {
      if (typeof amount !== 'number') return amount;
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
    }

    capitalize(str) {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    escapeHtml(str) {
      return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // Return a value only if it is a safe http(s) URL, else ''. Blocks
    // javascript:/data:/vbscript: URLs from reaching href/src attributes.
    safeUrl(u) {
      try {
        const x = new URL(String(u), location.href);
        return (x.protocol === 'http:' || x.protocol === 'https:') ? x.href : '';
      } catch (_) {
        return '';
      }
    }
  }

  // Export
  global.UIRenderer = UIRenderer;

})(window);
