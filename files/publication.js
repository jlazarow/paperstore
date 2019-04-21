/*\
  title: $:/plugins/jlazarow/paperstore/publication.js
  type: application/javascript
  module-type: library

  Common "publication" things.

  \*/
(function(){
    /*jslint node: true,browser: true */
    /*global $tw: false */
    "use strict";
    
function Conference(name) {
    this.name = name;
}

function ConferenceInstance(name, conference) {
    this.name = name;
    this.conference = conference;
}

function PaperSource(type, url) {
     this.type = type;
     this.url = url;
}

function Author(id, name, institution) {
    this.id = id;
    this.name = name;
    this.institution = institution || null;
}

function PaperReference(paper, isInfluential) {
    this.paper = paper;
    this.isInfluential = isInfluential; // null indicate unknown.
}

// note there is no "canonical" ID. "id" refers to _one of_ doi, arxiv, S2, or MA (and should be prefixed properly).
function Paper(id, title, type, year, references, citations, authors, publication, doi, arxivID, s2ID, maID, sources) {
    this.id = id;
    this.title = title;
    this.type = type;
    this.year = year;
    this.references = references || [];
    this.citations = citations || [];
    this.authors = authors || [];
    this.publication = publication || null;
    this.doi = doi || null;
    this.arxivID = arxivID || null;
    this.s2ID = s2ID || null;
    this.maID = maID || null;    
    this.sources = sources || [];
}

// ID prefixes supported.
Paper.MA = "ma";
Paper.arXiv = "arxiv";
Paper.DOI = "doi";
Paper.S2 = "s2";
    
exports.Conference = Conference;
exports.ConferenceInstance = ConferenceInstance;
exports.PaperSource = PaperSource
exports.Author = Author;
exports.PaperReference = PaperReference;
exports.Paper = Paper;
    
})();
