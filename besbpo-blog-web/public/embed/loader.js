(function() {
  'use strict';
  
  function initBesbpoFeed() {
    const feeds = document.querySelectorAll('[data-besbpo-tenant]');
    
    feeds.forEach(function(container) {
      const tenantId = container.getAttribute('data-besbpo-tenant');
      const division = container.getAttribute('data-division') || '';
      const maxItems = container.getAttribute('data-max-items') || '6';
      const mode = container.getAttribute('data-mode') || 'timeline';
      
      // Show loading state
      container.innerHTML = '<div class="besbpo-loading">Loading articles...</div>';
      
      // Fetch articles from syndication API
      const apiUrl = window.BESBPO_API_URL || 'http://localhost:3002';
      
      fetch(apiUrl + '/syndication/' + tenantId + '/articles?division=' + division + '&limit=' + maxItems)
        .then(function(response) {
          if (!response.ok) throw new Error('Failed to load articles');
          return response.json();
        })
        .then(function(data) {
          renderFeed(container, data.articles || [], mode);
        })
        .catch(function(error) {
          // Show mock data for demo
          container.innerHTML = '<div class="besbpo-feed"><p class="besbpo-demo">Demo: Configure tenant ID to display articles</p></div>';
          console.log('Besbpo Feed: Using demo mode');
        });
    });
  }
  
  function renderFeed(container, articles, mode) {
    if (!articles || articles.length === 0) {
      container.innerHTML = '<div class="besbpo-empty">No articles available</div>';
      return;
    }
    
    let html = '<div class="besbpo-feed besbpo-feed--' + mode + '">';
    
    articles.forEach(function(article) {
      html += '<article class="besbpo-feed__item">';
      html += '<h3 class="besbpo-feed__title"><a href="/articles/' + article.slug + '">' + article.title + '</a></h3>';
      html += '<p class="besbpo-feed__excerpt">' + (article.excerpt || '') + '</p>';
      html += '<div class="besbpo-feed__meta">';
      html += '<span class="besbpo-feed__date">' + formatDate(article.publishedAt) + '</span>';
      if (article.author) {
        html += '<span class="besbpo-feed__author">By ' + article.author.name + '</span>';
      }
      html += '</div></article>';
    });
    
    html += '</div>';
    container.innerHTML = html;
  }
  
  function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBesbpoFeed);
  } else {
    initBesbpoFeed();
  }
})();
