/**
 * @license
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

/* globals self CriticalRequestChainRenderer Util URL */

/** @typedef {import('./dom.js')} DOM */

/** @type {Array<string>} */
const URL_PREFIXES = ['http://', 'https://', 'data:'];

class DetailsRenderer {
  /**
   * @param {DOM} dom
   */
  constructor(dom) {
    /** @type {DOM} */
    this._dom = dom;
    /** @type {ParentNode} */
    this._templateContext; // eslint-disable-line no-unused-expressions
  }

  /**
   * @param {ParentNode} context
   */
  setTemplateContext(context) {
    this._templateContext = context;
  }

  /**
   * @param {LH.Audit.Details} details
   * @return {Element}
   */
  render(details) {
    switch (details.type) {
      case 'text':
        return this._renderText(/** @type {StringDetailsJSON} */ (details));
      case 'url':
        return this._renderTextURL(/** @type {StringDetailsJSON} */ (details));
      case 'bytes':
        return this._renderBytes(/** @type {NumericUnitDetailsJSON} */ (details));
      case 'ms':
        // eslint-disable-next-line max-len
        return this._renderMilliseconds(/** @type {NumericUnitDetailsJSON} */ (details));
      case 'link':
        // @ts-ignore - TODO(bckenny): Fix type hierarchy
        return this._renderLink(/** @type {LinkDetailsJSON} */ (details));
      case 'thumbnail':
        return this._renderThumbnail(/** @type {ThumbnailDetails} */ (details));
      case 'filmstrip':
        // @ts-ignore - TODO(bckenny): Fix type hierarchy
        return this._renderFilmstrip(/** @type {FilmstripDetails} */ (details));
      case 'table':
        // @ts-ignore - TODO(bckenny): Fix type hierarchy
        return this._renderTable(/** @type {TableDetailsJSON} */ (details));
      case 'code':
        return this._renderCode(/** @type {DetailsJSON} */ (details));
      case 'node':
        return this.renderNode(/** @type {LH.Audit.Details.NodeValue} */(details));
      case 'criticalrequestchain':
        return CriticalRequestChainRenderer.render(this._dom, this._templateContext,
          // @ts-ignore - TODO(bckenny): Fix type hierarchy
          /** @type {LH.Audit.Details.CriticalRequestChain} */ (details));
      case 'opportunity':
        // @ts-ignore - TODO(bckenny): Fix type hierarchy
        return this._renderTable(details);
      case 'numeric':
        return this._renderNumeric(/** @type {StringDetailsJSON} */ (details));
      case 'screenshot':
      case 'multicheck':
      case 'diagnostic':
        // Don't do this.
        return this._dom.createElement('div');
      default: {
        details.type
        throw new Error(`Unknown type: ${details.type}`);
      }
    }
  }

  /**
   * @param {{value: number, granularity?: number}} details
   * @return {Element}
   */
  _renderBytes(details) {
    // TODO: handle displayUnit once we have something other than 'kb'
    const value = Util.formatBytesToKB(details.value, details.granularity);
    return this._renderText({value});
  }

  /**
   * @param {{value: number, granularity?: number, displayUnit?: string}} details
   * @return {Element}
   */
  _renderMilliseconds(details) {
    let value = Util.formatMilliseconds(details.value, details.granularity);
    if (details.displayUnit === 'duration') {
      value = Util.formatDuration(details.value);
    }

    return this._renderText({value});
  }

  /**
   * @param {{value: string}} text
   * @return {HTMLElement}
   */
  _renderTextURL(text) {
    const url = text.value;

    let displayedPath;
    let displayedHost;
    let title;
    try {
      const parsed = Util.parseURL(url);
      displayedPath = parsed.file === '/' ? parsed.origin : parsed.file;
      displayedHost = parsed.file === '/' ? '' : `(${parsed.hostname})`;
      title = url;
    } catch (e) {
      displayedPath = url;
    }

    const element = this._dom.createElement('div', 'lh-text__url');
    element.appendChild(this._renderText({
      value: displayedPath,
    }));

    if (displayedHost) {
      const hostElem = this._renderText({
        value: displayedHost,
      });
      hostElem.classList.add('lh-text__url-host');
      element.appendChild(hostElem);
    }

    if (title) element.title = url;
    return element;
  }

  /**
   * @param {LH.Audit.Details.LinkValue} details
   * @return {Element}
   */
  _renderLink(details) {
    const allowedProtocols = ['https:', 'http:'];
    const url = new URL(details.url);
    if (!allowedProtocols.includes(url.protocol)) {
      // Fall back to just the link text if protocol not allowed.
      return this._renderText({
        value: details.text,
      });
    }

    const a = this._dom.createElement('a');
    a.rel = 'noopener';
    a.target = '_blank';
    a.textContent = details.text;
    a.href = url.href;

    return a;
  }

  /**
   * @param {{value: string}} text
   * @return {Element}
   */
  _renderText(text) {
    const element = this._dom.createElement('div', 'lh-text');
    element.textContent = text.value;
    return element;
  }

  /**
   * @param {{value: string}} text
   * @return {Element}
   */
  _renderNumeric(text) {
    const element = this._dom.createElement('div', 'lh-numeric');
    element.textContent = text.value;
    return element;
  }

  /**
   * Create small thumbnail with scaled down image asset.
   * If the supplied details doesn't have an image/* mimeType, then an empty span is returned.
   * @param {{value: string}} details
   * @return {Element}
   */
  _renderThumbnail(details) {
    const element = this._dom.createElement('img', 'lh-thumbnail');
    const strValue = details.value;
    element.src = strValue;
    element.title = strValue;
    element.alt = '';
    return element;
  }

  /**
   * Render a details item value for embedding in a table. Renders the type
   * based on the heading's valueType, unless the value itself has a `type`
   * property to override it.
   * @param {LH.Audit.Details.TableItem[string] | LH.Audit.Details.OpportunityItem[string]} value
   * @param {LH.Audit.Details.OpportunityColumnHeading} heading
   * @return {Element|null}
   */
  _renderTableValue(value, heading) {
    if (typeof value === 'undefined' || value === null) {
      return null;
    }

    // First deal with the possible object forms of item.
    if (typeof value === 'object') {
      // Use the value's type to override the heading's for this column.
      const valueType = value.type || heading.valueType;

      switch (valueType) {
        case 'code': {
          const codeValue = /** @type {LH.Audit.Details.CodeValue} */ (value);
          return this._renderCode(codeValue);
        }
        case 'link': {
          const linkValue = /** @type {LH.Audit.Details.LinkValue} */ (value);
          return this._renderLink(linkValue);
        }
        case 'node': {
          const nodeValue = /** @type {LH.Audit.Details.NodeValue} */ (value);
          return this.renderNode(nodeValue);
        }
        case 'url': {
          const urlValue = /** @type {LH.Audit.Details.UrlValue} */ (value);
          return this._renderTextURL(urlValue);
        }
        default: {
          throw new Error(`Unknown valueType: ${valueType}`);
        }
      }
    }

    // Next, deal with primitives.
    switch (heading.valueType) {
      case 'bytes': {
        const numValue = Number(value);
        return this._renderBytes({value: numValue, granularity: 1});
      }
      case 'code': {
        const strValue = String(value);
        return this._renderCode({value: strValue});
      }
      case 'ms': {
        const msValue = {
          value: Number(value),
          granularity: heading.granularity,
          displayUnit: heading.displayUnit,
        };
        return this._renderMilliseconds(msValue);
      }
      case 'numeric': {
        const strValue = String(value);
        return this._renderNumeric({value: strValue});
      }
      case 'text': {
        const strValue = String(value);
        // TODO(bckenny): drop value?
        return this._renderText({value: strValue});
      }
      case 'thumbnail': {
        const strValue = String(value);
        return this._renderThumbnail({value: strValue});
      }
      case 'timespanMs': {
        const numValue = Number(value);
        return this._renderMilliseconds({value: numValue});
      }
      case 'url': {
        const strValue = String(value);
        if (URL_PREFIXES.some(prefix => strValue.startsWith(prefix))) {
          return this._renderTextURL({value: strValue});
        } else {
          // Fall back to <pre> rendering if not actually a URL.
          return this._renderCode({value: strValue});
        }
      }
      default: {
        throw new Error(`Unknown valueType: ${heading.valueType}`);
      }
    }
  }

  /**
   * Unify the two two column heading types until we have audits all use the
   * same format. Outputs the newer OpportunityColumnHeading.
   * @param {Array<LH.Audit.Details.TableColumnHeading|LH.Audit.Details.OpportunityColumnHeading>} headings
   * @return {Array<LH.Audit.Details.OpportunityColumnHeading>} header
   */
  _canonicalizeTableHeadings(headings) {
    return headings.map(heading => {
      if ('label' in heading) {
        return heading;
      }

      return {
        key: heading.key,
        label: heading.text,
        valueType: heading.itemType,
        displayUnit: heading.displayUnit,
        granularity: heading.granularity,
      };
    });
  }

  /**
   * @param {LH.Audit.Details.Table|LH.Audit.Details.Opportunity} details
   * @return {Element}
   */
  _renderTable(details) {
    if (!details.items.length) return this._dom.createElement('span');

    const tableElem = this._dom.createElement('table', 'lh-table');
    const theadElem = this._dom.createChildOf(tableElem, 'thead');
    const theadTrElem = this._dom.createChildOf(theadElem, 'tr');

    const headings = this._canonicalizeTableHeadings(details.headings);

    for (const heading of headings) {
      const valueType = heading.valueType || 'text';
      const classes = `lh-table-column--${valueType}`;
      const labelEl = this._dom.createElement('div', 'lh-text');
      labelEl.textContent = heading.label;
      this._dom.createChildOf(theadTrElem, 'th', classes).appendChild(labelEl);
    }

    const tbodyElem = this._dom.createChildOf(tableElem, 'tbody');
    for (const row of details.items) {
      const rowElem = this._dom.createChildOf(tbodyElem, 'tr');
      for (const heading of headings) {
        const value = row[heading.key];
        const valueElement = this._renderTableValue(value, heading);

        if (valueElement) {
          const classes = `lh-table-column--${heading.valueType}`;
          this._dom.createChildOf(rowElem, 'td', classes).appendChild(valueElement);
        } else {
          this._dom.createChildOf(rowElem, 'td', 'lh-table-column--empty');
        }
      }
    }
    return tableElem;
  }

  /**
   * @param {LH.Audit.Details.NodeValue} item
   * @return {Element}
   * @protected
   */
  renderNode(item) {
    const element = this._dom.createElement('span', 'lh-node');
    if (item.snippet) {
      element.textContent = item.snippet;
    }
    if (item.selector) {
      element.title = item.selector;
    }
    if (item.path) element.setAttribute('data-path', item.path);
    if (item.selector) element.setAttribute('data-selector', item.selector);
    if (item.snippet) element.setAttribute('data-snippet', item.snippet);
    return element;
  }

  /**
   * @param {LH.Audit.Details.Filmstrip} details
   * @return {Element}
   */
  _renderFilmstrip(details) {
    const filmstripEl = this._dom.createElement('div', 'lh-filmstrip');

    for (const thumbnail of details.items) {
      const frameEl = this._dom.createChildOf(filmstripEl, 'div', 'lh-filmstrip__frame');
      this._dom.createChildOf(frameEl, 'img', 'lh-filmstrip__thumbnail', {
        src: `data:image/jpeg;base64,${thumbnail.data}`,
        alt: `Screenshot`,
      });
    }
    return filmstripEl;
  }

  /**
   * @param {{value?: string|number}} details
   * @return {Element}
   */
  _renderCode(details) {
    const pre = this._dom.createElement('pre', 'lh-code');
    pre.textContent = /** @type {string} */ (details.value);
    return pre;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DetailsRenderer;
} else {
  self.DetailsRenderer = DetailsRenderer;
}

// TODO, what's the diff between DetailsJSON and NumericUnitDetailsJSON?
/**
 * @typedef {{
      type: string,
      value: (string|number|undefined),
      granularity?: number,
      displayUnit?: string
  }} DetailsJSON
 */

/**
 * @typedef {{
      type: string,
      value: string,
      granularity?: number,
      displayUnit?: string,
  }} StringDetailsJSON
 */

/**
 * @typedef {{
      type: string,
      value: number,
      granularity?: number,
      displayUnit?: string,
  }} NumericUnitDetailsJSON
 */

/**
 * @typedef {{
      itemType: string,
      key: string,
      text?: string,
      granularity?: number,
      displayUnit?: string,
  }} TableHeaderJSON
 */

/** @typedef {{
      type: string,
      items: Array<DetailsJSON>,
      headings: Array<TableHeaderJSON>
  }} TableDetailsJSON
 */

/** @typedef {{
      type: string,
      value: string,
  }} ThumbnailDetails
 */

