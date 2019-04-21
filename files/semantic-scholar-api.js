/*\
  title: $:/plugins/jlazarow/paperstore/semantic-scholar-api.js
  type: application/javascript
  module-type: library

  Trying to talk to the S2 API.

  \*/
(function(){

/*jslint node: true,browser: true */
/*global $tw: false */
"use strict";

var Publication = require("$:/plugins/jlazarow/paperstore/publication.js");        
var http;
if ($tw.node) {
    http = require("http");    
}
    
var S2_HOSTNAME = "api.semanticscholar.org";
var S2_PATH = "/v1/paper";

Publication.Paper.parseS2 = function(data) {
    var arxivID = data["arxivId"];
    var doi = data["doi"];
    var s2ID = data["paperId"];

    var referenceID = null;
    if (arxivID != null) {
        arxivID = Publication.Paper.arXiv + ":" + arxivID;
        referenceID = arxivID
    }

    if (doi != null) {
        doi = Publication.Paper.DOI + ":" + doi;
        if (referenceID == null) {
            referenceID = doi;
        }
    }

    if (s2ID != null) {
        s2ID = Publication.Paper.S2 + ":" + s2ID;
        if (referenceID == null) {
            referenceID = s2ID;
        }
    }

    if (referenceID == null) {
        console.log("no reference ID found");
        return null;
    }

    var title = data["title"];
    var year = data["year"];

    // read the authors.
    var authors = [];
    var authorsData = data["authors"];
    for (var authorIndex = 0; authorIndex < authorsData.length; authorIndex++) {
        var authorData = authorsData[authorIndex];
        var authorID = Publication.Paper.S2 + ":" + authorData["authorId"];
        var authorName = authorData["name"];

        authors.push(new Publication.Author(authorID, authorName, null));
    }

    return new Publication.Paper(
        referenceID, title, null, year, [], [], authors, null, doi, arxivID, s2ID, null, []);
}
    
function S2PaperReference(paper, isInfluential) {
    Publication.PaperReference.call(this, paper, isInfluential);
}

S2PaperReference.prototype = Object.create(Publication.PaperReference.prototype);
S2PaperReference.prototype.constructor = Publication.PaperReference;

S2PaperReference.parse = function(data) {
    var paper = Publication.Paper.parseS2(data);
    var isInfluential = data["isInfluential"];

    return new S2PaperReference(paper, isInfluential);
}
    
function SemanticScholarAPI() {
}

SemanticScholarAPI.request = function(id) {
    console.log("S2API: request of " + id);
    // id should be a "compatible" id e.g. arxiv:blah. TODO: remove doi:.
    var requestPath = S2_PATH + "/" + id;
    return new Promise(
        (resolve, reject) => {
            var req = http.get({
                "hostname": S2_HOSTNAME,
                "path": requestPath,
                "headers": {
                    "accept": "application/json",
                }
            },
            function(response) {
                // The paper wasn't found, just resolve to a stupid object to be pruned later.
                if (response.statusCode == 404) {
                    console.log("paper not found");
                    reject("not found");
                }
                
                if (response.statusCode != 200) {
                    reject("status code: " + response.statusCode);
                }
                
                var data = "";
                response.on("data", function(chunk) {
                    data += chunk;
                });
                                    
                response.on("end", function() {
                    let parsed = JSON.parse(data);
                    resolve(parsed);
                });
            });

            req.on("error", function(err) {
                reject(err);
            });
        });
}

SemanticScholarAPI.resolve = function(paper) {
    // figure out how to look this paper up.
    // it seems arXiv is the most favored.
    var requestPromise = null;

    // can't be an S2 itself.
    if (paper.s2ID != null) {
        requestPromise = SemanticScholarAPI.request(paper.s2ID.split(":")[1]);
    }
    else if (paper.arxivID != null) {
        requestPromise = SemanticScholarAPI.request(paper.arxivID);
    }
    else if (paper.doi != null) {
        requestPromise = SemanticScholarAPI.request(paper.doi.split(":")[1]);
    }

    if (requestPromise == null) {
        return paper;
    }

    return requestPromise.then(function(data) {
        let authorsData = data["authors"];
        if (authorsData.length >= paper.authors.length) {
            let authors = [];

            for (let authorIndex = 0; authorIndex < authorsData.length; authorIndex++) {
                let authorData = authorsData[authorIndex];
                let authorID = Publication.Paper.S2 + ":" + authorData["authorId"];
                let authorName = authorData["name"];

                authors.push(new Publication.Author(authorID, authorName, null));
            }

            paper.authors = authors;
        }
        
        // If we found good references, replace them.
        let referencesData = data["references"];
        if (referencesData.length >= paper.references.length) {
            let references = [];
            
            for (let referenceIndex = 0; referenceIndex < referencesData.length; referenceIndex++) {
                // determine what reference data we have (favor arXiv -> DOI -> S2).
                var referenceData = referencesData[referenceIndex];
                var reference = S2PaperReference.parse(referenceData);
                if (reference != null) {
                    references.push(reference);
                }
            }

            paper.references = references;
        }

        // neither citations.
        let citationsData = data["citations"];
        if (citationsData.length >= paper.citations.length) {
            let citations = [];
            
            for (let citationIndex = 0; citationIndex < citationsData.length; citationIndex++) {
                // determine what reference data we have (favor arXiv -> DOI -> S2).
                var citationData = citationsData[citationIndex];
                var citation = S2PaperReference.parse(citationData);
                if (citation != null) {
                    citations.push(citation);
                }
            }

            paper.citations = citations;
        }

        var arxivID = data["arxivId"];
        if (arxivID != null && paper.arxivID == null) {
            paper.arxivID = Publication.Paper.arXiv + ":" + arxivID;
        }

        // always trust the source.
        paper.s2ID = Publication.Paper.S2 + ":" + data["paperId"];

        return paper;
    }).catch(function(err) {
        return {
            "citations": []
        };
    });
}

exports.SemanticScholarAPI = SemanticScholarAPI;

})();
