/*\
  title: $:/plugins/jlazarow/paperstore/academic-api.js
  type: application/javascript
  module-type: library

  Trying to talk to the Microsoft Academic API.

  \*/
(function(){
/*jslint node: true,browser: true */
/*global $tw: false */
"use strict";

// todo, allow this to run on the client too.    
var https;
if ($tw.node) {
    https = require("https");    
}
    
var Publication = require("$:/plugins/jlazarow/paperstore/publication.js");    

// attributes we're interested in.
var ATTRIBUTE_ID = "Id";
var ATTRIBUTE_ENTITY_TYPE = "Ty";
var ATTRIBUTE_TITLE = "Ti";
var ATTRIBUTE_PAPER_TYPE = "Pt";
var ATTRIBUTE_YEAR = "Y";
var ATTRIBUTE_CITATION_COUNT = "CC";
var ATTRIBUTE_REFERENCE_IDS = "RId";
var ATTRIBUTE_AUTHORS = "AA";    
var ATTRIBUTE_AUTHOR_NAMES = "AA.DAuN";
var ATTRIBUTE_AUTHOR_IDS = "AA.AuId";
var ATTRIBUTE_AUTHOR_INSTITUTIONS = "AA.DAfN";
var ATTRIBUTE_CONFERENCE = "C";    
var ATTRIBUTE_CONFERENCE_NAME = "C.CN";
var ATTRIBUTE_CONFERENCE_ID = "C.CId";
var ATTRIBUTE_CONFERENCE_INSTANCE = "CI";    
var ATTRIBUTE_CONFERENCE_INSTANCE_NAME = "CI.CIN";
var ATTRIBUTE_CONFERENCE_INSTANCE_ID = "CI.CIId";    
var ATTRIBUTE_EXTENDED = "E";
var ATTRIBUTE_EXTENDED_DOI = "DOI";
var ATTRIBUTE_EXTENDED_SOURCE = "S";
    
var DEFAULT_ATTRIBUTES = [
    ATTRIBUTE_ID,
    ATTRIBUTE_ENTITY_TYPE,
    ATTRIBUTE_TITLE,
    ATTRIBUTE_PAPER_TYPE,
    ATTRIBUTE_YEAR,
    ATTRIBUTE_CITATION_COUNT,
    ATTRIBUTE_REFERENCE_IDS,
    ATTRIBUTE_AUTHOR_NAMES,
    ATTRIBUTE_AUTHOR_IDS,
    ATTRIBUTE_AUTHOR_INSTITUTIONS,
    ATTRIBUTE_CONFERENCE_NAME,
    ATTRIBUTE_CONFERENCE_ID,
    ATTRIBUTE_CONFERENCE_INSTANCE_NAME,    
    ATTRIBUTE_CONFERENCE_INSTANCE_ID,
    ATTRIBUTE_EXTENDED
]
    
function MAConference(id, name) {
    Publication.Conference.call(this, name);

    this.id = id;
}

MAConference.prototype = Object.create(Publication.Conference.prototype);
MAConference.prototype.constructor = Publication.Conference;
    
var CONFERENCE_NAME = "CN";
var CONFERENCE_ID = "CId";

MAConference.parse = function(data) {
    var id = data[CONFERENCE_ID];        
    var name = data[CONFERENCE_NAME];

    return new MAConference(id, name);
}

var CONFERENCE_INSTANCE_NAME = "CIN";
var CONFERENCE_INSTANCE_ID = "CIId";
    
function MAConferenceInstance(id, name, conference) {
    Publication.ConferenceInstance.call(this, name, conference);

    this.id = id;
}

MAConferenceInstance.prototype = Object.create(Publication.ConferenceInstance.prototype);
MAConferenceInstance.prototype.constructor = Publication.ConferenceInstance;
    
MAConferenceInstance.parse = function(data, conference) {
    var id = data[CONFERENCE_INSTANCE_ID];
    var name = data[CONFERENCE_INSTANCE_NAME];

    return new MAConferenceInstance(id, name, conference);
}

var SOURCE_URL = "U";
var SOURCE_TYPE = "Ty";
var SOURCE_TYPE_PDF = 3;

var ARXIV_HTTP_PREFIX = "http://arxiv.org/pdf/";
var ARXIV_HTTPS_PREFIX = "https://arxiv.org/pdf/";    
    
function MAPaperSource(type, url) {
    Publication.PaperSource.call(this, type, url);
}

MAPaperSource.prototype = Object.create(Publication.PaperSource.prototype);
MAPaperSource.prototype.constructor = Publication.PaperSource;
    
MAPaperSource.parse = function(data) {
    var type = data[SOURCE_TYPE];
    var url = data[SOURCE_URL];

    return new MAPaperSource(type, url);
}
    
var AUTHOR_NAME = "DAuN";
var AUTHOR_ID = "AuId";
var AUTHOR_INSTITUTION = "DAfN";
    
function MAAuthor(id, name, institution) {
    Publication.Author.call(this, id, name, institution);
}

MAAuthor.prototype = Object.create(Publication.Author.prototype);
MAAuthor.prototype.constructor = Publication.Author;
    
MAAuthor.parse = function(data) {
    var id = Publication.Paper.MA + ":" + data[AUTHOR_ID];        
    var name = data[AUTHOR_NAME];
    var institution = data[AUTHOR_INSTITUTION];

    return new MAAuthor(id, name, institution);
}

function MAPaperReference(paper, isInfluential) {
    Publication.PaperReference.call(this, paper, isInfluential);
}

MAPaperReference.prototype = Object.create(Publication.PaperReference.prototype);
MAPaperReference.prototype.constructor = Publication.PaperReference;

Publication.Paper.parseMA = function(data) {
    var id = Publication.Paper.MA + ":" + data[ATTRIBUTE_ID];
    var title = data[ATTRIBUTE_TITLE];
    var paperType = data[ATTRIBUTE_PAPER_TYPE];
    var year = data[ATTRIBUTE_YEAR];

    // references.
    var referenceIDs = data[ATTRIBUTE_REFERENCE_IDS] || [];
    var references = [];
    for (var referenceIndex = 0; referenceIndex < referenceIDs.length; referenceIndex++) {
        var referenceID = Publication.Paper.MA + ":" + referenceIDs[referenceIndex];

        // create a partial Paper to wrap this reference.
        references.push(new MAPaperReference(new Publication.Paper(referenceID), null));
    }

    // MA doesn't provide citations.
    var citations = [];

    // todo, sort by "S".
    var authors = [];
    var authorsData = data[ATTRIBUTE_AUTHORS];
    for (var authorIndex = 0; authorIndex < authorsData.length; authorIndex++) {
        var authorData = authorsData[authorIndex];

        var author = MAAuthor.parse(authorData);
        authors.push(author)
    }

    var publication = null;
    var instance = null;
    if (ATTRIBUTE_CONFERENCE in data) {
        publication = MAConference.parse(data[ATTRIBUTE_CONFERENCE]);

        if (ATTRIBUTE_CONFERENCE_INSTANCE in data) {
            instance = MAConferenceInstance.parse(data[ATTRIBUTE_CONFERENCE_INSTANCE], publication);
        }
    }

    var doi = null;
    var sources = [];
    if (ATTRIBUTE_EXTENDED in data) {
        var extendedData = JSON.parse(data[ATTRIBUTE_EXTENDED]);

        if (ATTRIBUTE_EXTENDED_DOI in extendedData) {
            doi = Publication.Paper.DOI + ":" + extendedData[ATTRIBUTE_EXTENDED_DOI];
        }

        // read sources.
        if (ATTRIBUTE_EXTENDED_SOURCE in extendedData) {
            var sourcesData = extendedData[ATTRIBUTE_EXTENDED_SOURCE];
            for (var sourceIndex = 0; sourceIndex < sourcesData.length; sourceIndex++) {
                var sourceData = sourcesData[sourceIndex];
                var source = MAPaperSource.parse(sourceData);

                sources.push(source);
            }
        }
    }

    var s2ID = null;    
    var arxivID = null;

    // try and tease this out of a source for arXiv;
    for (var sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
        var source = sources[sourceIndex];
        if (source.type == SOURCE_TYPE_PDF) {
            if (source.url.startsWith(ARXIV_HTTP_PREFIX)) {
                var pdfName = source.url.substring(ARXIV_HTTP_PREFIX.length);
                var pdfNameParts = pdfName.split(".");
                arxivID = Publication.Paper.arXiv + ":" + pdfNameParts[0] + "." + pdfNameParts[1];
                break;
            }
            else if (source.url.startsWith(ARXIV_HTTPS_PREFIX)) {
                var pdfName = source.url.substring(ARXIV_HTTPS_PREFIX.length);
                var pdfNameParts = pdfName.split(".");
                arxivID = Publication.Paper.arXiv + ":" + pdfNameParts[0] + "." + pdfNameParts[1];
                break;
            }
        }
    }
    
    return new Publication.Paper(id, title, paperType, year, references, citations, authors, instance, doi, arxivID, s2ID, id, sources);
}

var ACADEMIC_HOSTNAME = "api.labs.cognitive.microsoft.com";
var ACADEMIC_PATH = "/academic/v1.0";
var INTERPRET_ACTION = "interpret";
var EVALUATE_ACTION = "evaluate";
    
function AcademicAPI(apiKey) {
    this.apiKey = apiKey;
}

AcademicAPI.prototype.interpret = function(query, limit) {
    limit = limit || 0;

    var requestPath = ACADEMIC_PATH + "/" + INTERPRET_ACTION;

    requestPath += "?query=" + encodeURIComponent(query);

    if (limit > 0) {
        requestPath += "&count=" + limit;
    }

    return new Promise(
        (resolve, reject) => {
            console.log(this.apiKey);            
            let req = https.get({
                "hostname": ACADEMIC_HOSTNAME,
                "port": 443,
                "path": requestPath,
                "headers": {
                    "accept": "application/json",
                    "Ocp-Apim-Subscription-Key": this.apiKey
                }
            },
            function(response) {
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
            })
        }
);
}

AcademicAPI.prototype.evaluate = function(expr, limit) {
    limit = limit || 0;
    
    var requestPath = ACADEMIC_PATH + "/" + EVALUATE_ACTION;

    requestPath += "?expr=" + encodeURIComponent(expr);
    requestPath += "&model=latest";
    
    if (limit > 0) {
        requestPath += "&count=" + limit;
    }

    requestPath += "&offset=0";
    requestPath += ("&attributes=" + DEFAULT_ATTRIBUTES.join(","));

    return new Promise(
        (resolve, reject) => {
            var req = https.get({
                "hostname": ACADEMIC_HOSTNAME,
                "port": 443,
                "path": requestPath,
                "headers": {
                    "accept": "application/json",
                    "Ocp-Apim-Subscription-Key": this.apiKey
                }
            },
            function(response) {
                if (response.statusCode != 200) {
                    reject("status code: " + response.statusCode);
                }
                
                var data = "";
                response.on("data", function(chunk) {
                    data += chunk;
                });
                                    
                response.on("end", function() {
                    let parsed = JSON.parse(data);
                    resolve(parsed["entities"]);
                });
            });

            req.on("error", function(err) {
                reject(err);
            });            
        });   
    // return new Promise(
    //     (resolve, reject) => {
    //         $tw.utils.httpRequest({
    //             url: requestURL,
    //             type: "GET",
    //             headers: {
    //                 "accept": "application/json",
    //                 "Ocp-Apim-Subscription-Key": this.apiKey
    //             },                
    //             callback: function(error, data) {
    //                 if (error) {
    //                     reject(error);
    //                 }
                    
    //                 let content = JSON.parse(data);
    //                 console.log(content);
    //                 resolve(content["entities"]);
    //             }
    //         })
    //     });
}
    
var INTERPRETATIONS = "interpretations";
var GET_PAPERS = "#GetPapers";
var ENTITY_PAPER = 0;    
    
AcademicAPI.prototype.getPaper = function(query, limit) {
    limit = limit || 0;

    // first interpret.
    console.log("AcademicAPI, querying for " + query);
    return this.interpret(query, limit).then(function(interpretData) {
        var interpretations = interpretData["interpretations"];
        console.log("interpretations:");
        console.log(interpretations);
        var queries = [];
        for (let interpretationIndex = 0; interpretationIndex < interpretations.length; interpretationIndex++) {
            let interpretation = interpretations[interpretationIndex];
            let rules = interpretation["rules"];

            for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex++) {
                let rule = rules[ruleIndex];

                if (rule["name"] == GET_PAPERS) {
                    queries.push(rule["output"]["value"]);
                }
            }
        }

        return this.evaluate(queries);
    }.bind(this)).then(function(entities) {
        let paperPromises = [];
        console.log("found " + entities.length + " entities");
        
        for (let entityIndex = 0; entityIndex < entities.length; entityIndex++) {
            let entity = entities[entityIndex];
            if (entity["Ty"] == ENTITY_PAPER) {
                paperPromises.push(Promise.resolve(Publication.Paper.parseMA(entity)));
            }
        }

        return Promise.all(paperPromises);
    });
}

exports.AcademicAPI = AcademicAPI;
    
})();
