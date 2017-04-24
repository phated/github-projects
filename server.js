'use strict';

var fs = require('fs');

var yo = require('yo-yo');
var when = require('when');
var fetch = require('isomorphic-fetch');

var headers = {
  headers: {
    Accept: 'application/vnd.github.inertia-preview+json',
    Authorization: `token ${process.env.GITHUB_TOKEN}`
  }
};

function projectListView(projects, selectedId) {
  return projects.map(function(project) {
    var classes = 'tabnav-tab';
    if (project.id === selectedId) {
      classes += ' selected';
    }

    var href = `/${project.id}`;

    return yo`
      <a href=${href} class=${classes}>${project.name}</a>
    `;
  });
}

function containerView(projects, selectedId, body) {
  return yo`
    <html lang="en" dir="ltr">
      <head>
        <title>Gulp Roadmap</title>
        <meta charset="utf-8">
        <link rel="stylesheet" href="/node_modules/primer-css/build/build.css">
      </head>
      <body>
        <div class="container">
          <div class="columns">
            <div class="single-column p-3">
              <div class="tabnav">
                <nav class="tabnav-tabs">
                  ${projectListView(projects, selectedId)}
                </nav>
              </div>
            </div>
          </div>

          <div id="tracker" class="columns">
            ${body}
          </div>
        </div>
      </body>
    </html>
  `;
}

function cardView(card) {
  return yo`
    <a class="menu-item" href=${card.content_url}>
      <span class="state state-${card.content.state} p-1">${card.content.state}</span> ${card.content.title}
    </a>
  `;
}

function columnView(column) {
  var cards = column.cards.map(cardView);

  return yo`
    <div class="one-fifth column">
      <nav class="menu">
        <span class="menu-heading">${column.name} <span class="counter">${column.cards.length}</span></span>
        ${cards}
      </nav>
    </div>
  `;
}

async function handler(req, res) {
  var url = req.url;

  if (url === '/node_modules/primer-css/build/build.css') {
    res.setHeader('Content-Type', 'text/css; charset=UTF-8')
    return fs.createReadStream('./node_modules/primer-css/build/build.css');
  }

  var id;
  var match = /\/(\d+)/.exec(url);
  if (match) {
    id = parseInt(match[1]);
  }

  var projectsResponse = await fetch('https://api.github.com/orgs/gulpjs/projects', headers);
  var projects = await projectsResponse.json();

  if (!id) {
    // default view
    return `
      <!DOCTYPE html>
      ${containerView(projects, id, 'Select a project to view the Project Tracker')}
    `;
  }

  var columnsResponse = await fetch(`https://api.github.com/projects/${id}/columns`, headers);
  var columns = await columnsResponse.json();

  var columnsWithCards = await when.map(columns, getColumnDetails);

  var body = columns.map(columnView);

  return `
    <!DOCTYPE html>
    ${containerView(projects, id, body)}
  `;
}

async function getColumnDetails(column) {
  var cardsResponse = await fetch(column.cards_url, headers);
  var cards = await cardsResponse.json();

  var cardsWithContents = await when.map(cards, getCardDetails);

  column.cards = cardsWithContents;
  return column;
}

async function getCardDetails(card) {
  var contentResponse = await fetch(card.content_url, headers);
  var content = await contentResponse.json();

  card.content = content;

  return card;
}

module.exports = handler;
