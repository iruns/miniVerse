$(function(){

$.ajaxSetup ({
	cache: false
});

// get the complete list of ranks
let ranks;
let nRanks;// length of ranks
getRanks();
function getRanks(){
	let loadUrl = "get_ranks.php";
	$.get(loadUrl,{},
	function(data, status){
		ranks = JSON.parse(data);
		nRanks = ranks.length;
		// getTaxon("Panthera");
		// getTaxon("Ailurus fulgens");
		// getTaxon("Primates");
		getTaxon("Metatheria");
		// getTaxon("Mammal");
	})
}

$("#taxonomy").scroll(animateTaxa);

// get taxon from the search form
$('#search_form').submit(function (e) {
	let seach_term_str = $('#search_bar').val();
	if(seach_term_str.length >= 3){
			getTaxon(seach_term_str);
	}
	else if (seach_term_str.length > 0) {
		$("#result").html("Please input more than 2 characters");
	}
	e.preventDefault();
});

let taxaById;// unranked
let rankedTaxa;

let responseType = -1;

let ranksPosition;// y position of ranks ul
let rankXs;// x position target

let animMS;
let taxaAnim;

//	fetch the ranked taxa from the taxon
function getTaxon(taxon){
	let loadUrl = "get_taxon.php";
	$.get(loadUrl,
	{
		search_term:taxon
	},
	function(data, status){
		// first, sort the unsorted ranked taxa
		// console.log(data);
		responseType = data.slice(0,1);
		data = data.slice(1);
		// if found (0)
		if(responseType==="0"){
			let taxa = JSON.parse(data);

			// hide the unclassified and environmental samples
			for(let i=0; i<taxa.length; i++) {
				let label = taxa[i]["_label"];
				if(label.indexOf("unclassified")!=-1 || label.indexOf("environmental samples")!=-1 || label.indexOf("unidentified")!=-1){
					taxa.splice(i, 1);
					i--;
				}
			}

			let nTaxa = taxa.length;
			// organize taxa by id and rank
			taxaById = [];
			let unsortedRankedTaxa = [];
			for(let i=0; i<nTaxa; i++) {
				// organize by id
				let _id = taxa[i]["_id"];
				taxaById[_id] = taxa[i];

				// organize by rank
				let rank = taxa[i]["rank"];
				if(unsortedRankedTaxa[rank]==undefined){
					unsortedRankedTaxa[rank] = [];
				}
				unsortedRankedTaxa[rank].push(taxa[i]);
			}

			rankedTaxa = [];
			for(let i=0; i<nRanks; i++) {
				if(unsortedRankedTaxa[ranks[i]._id] != undefined) {
					let taxaInRank = unsortedRankedTaxa[ranks[i]._id];
					rankedTaxa.push({_label:ranks[i]._label, order:ranks[i].rank_order, cs:taxaInRank});
					// save the rank order for subclass sorting
					for(let t=0; t<taxaInRank.length; t++){
						taxaInRank[t]["rank_order"] = i;
					}
				}
			}
			// console.log(JSON.stringify(rankedTaxa));
			// then render it using react
			let rootElement =
		    React.createElement('ul', {id:'ranks'},
					rankedTaxa.map(rank => {return React.createElement
						(
							RankItem,
							{key: rank.order, _label: rank._label, taxa: rank.cs}
						)
					})
				)
			ReactDOM.render(rootElement, document.getElementById('react_dom'));

			ranksPosition = $("#ranks").position();

			// position the ranks horizontally according to max width of the taxa contained
			let rankWidth = 300;
				// $(start).find(".info_container").first();
			rankXs = [];
			let prevX = 0;
			$("#ranks").children(".Rank").each(function(i, e) {
				let maxWidth = 0;
				// look for max width
				$(e).find(".Taxon").each(function(ti, te) {
					let infoContainer = $(te).find(".info_container").first();
					let totalWidth = infoContainer.position().left + infoContainer.width() + 20;// 20 because if not given some margin the infoContainer can be sent down
					// set taxon width so it just fit the content
					$(te).css({width:totalWidth});
					maxWidth = Math.max(maxWidth, totalWidth);
				});
				rankXs[i] = prevX;
				$(e).css({width:maxWidth});
				prevX += maxWidth + 50;
			});

			// set container width to right most rank
			$("#container").css({width: rankWidth * rankXs.length});

			// save the taxa's y positions
			lastTaxonY = 10;// top margin
			positionTaxon(rankedTaxa[0]["cs"][0]);
			// console.log(lastTaxonY);
			// set container height to lowest taxon + taxa y position
			$("#container").css({height: lastTaxonY + $(".taxa").first().position().top});

			// animate positions and render lines
			animMS = 300;
			taxaAnim = setInterval(function(){ animateTaxa() }, 30);
			// taxaAnim();
		}
		// if not found and found possibilities (1)
		else if(responseType==="1"){
			// clear line canvas
			canvas2d.clearRect(0, 0, $(canvas).attr("width"), $(canvas).attr("height"));

			let taxa = JSON.parse(data);
			// hide the unclassified and environmental samples
			for(let i=0; i<taxa.length; i++) {
				let label = taxa[i]["_label"];
				if(label.indexOf("unclassified")!=-1 || label.indexOf("environmental sample")!=-1 || label.indexOf("unidentified")!=-1){
					taxa.splice(i, 1);
					i--;
				}
			}
			// then render it using react
			let rootElement =
		    React.createElement('div', {id:'possible_matches'},
			    React.createElement('p', {}, "Sorry we couldn't find '" + taxon + "'. Here are some similar results:"),
			    React.createElement('ul', {id:'taxa'},
						taxa.map(taxon => {return React.createElement
							(
								TaxonItem,
								{
									key:taxon._id,
									_label: taxon._label,
									_id: taxon._id,
									_alternative_labels:taxon._alternative_labels,
									image_wikimedia:taxon.image_wikimedia,
									image_height: taxon.image_height
								}
							)
						})
					)
				)
			ReactDOM.render(rootElement, document.getElementById('react_dom'));

			$("#taxa").children(".Taxon").each((i,e)=>{
				$(e).css({height: $(e).height(), position:"relative", "margin-bottom":50 });
			});
		}
		// if not found at all (2)
		else if(responseType==="2"){
			// clear line canvas
			canvas2d.clearRect(0, 0, $(canvas).attr("width"), $(canvas).attr("height"));

			$("#react_dom").html("Sorry we couldn't find '" + taxon + "'. Please try another search terms.");
		}

		// set search bar value to label of focus taxon
		if(taxaById != undefined && taxaById[taxon]!=undefined){
			taxon = taxaById[taxon]["_label"];
		}
		$('#search_bar').val(taxon);
	});
}

let lastTaxonY;

function positionTaxon(taxon){
	let height = $("#"+taxon["_id"]).height();
	let margin = 5;

	if(taxon["_subclasses"]!= undefined){

		// replace subclass ids with json objects
		let subclasses = taxon["_subclasses"];
		for(let i=0; i<subclasses.length; i++){
			subclasses[i] = taxaById[subclasses[i]];
			if(subclasses[i] == undefined){
				subclasses.splice(i, 1);
				i--;
			}
		}
		// and sort the subclasses
		subclasses.sort(function(a, b){
	    var keyA = a.rank_order,
	        keyB = b.rank_order;
	    // Compare the 2 orders
	    if(keyA < keyB) return -1;
	    if(keyA > keyB) return 1;
	    return 0;
		});

		let minY;
		let maxY;

		// save the original lastTaxonY in case the children are shorter than the parent
		let parentLastTaxonY = lastTaxonY;

		for(let i=0; i<subclasses.length; i++) {
			if(i== 0){
				minY = lastTaxonY;
			}
			subclasses[i]["target_y"] = lastTaxonY;
			// console.log(taxon["_label"] + " > " + subclasses[i]["_label"] + " " + subclasses[i]["target_y"]);
			// console.log("   " + $("#"+subclasses[i]["_id"]).height());
			positionTaxon(subclasses[i]);
			if(i==subclasses.length-1){
				maxY = subclasses[i]["target_y"];
			}
		}
		// center the parent taxon vertically
		taxon["target_y"] = minY + ((maxY-minY)/2);

		// and if the children are shorter than the parent, add lastTaxonY by the parent's height
		if(lastTaxonY-minY < height){
			lastTaxonY = parentLastTaxonY + height + margin;
			// console.log(taxon["_label"] + " set " + lastTaxonY);
		}
	}
	else{
		// console.log(taxon["_label"] + " " + lastTaxonY + " + " + height);
		lastTaxonY += height + margin;
	}
}

function animateTaxa(){
	if(responseType === "0"){
		$("#ranks").children(".Rank").each((i,e)=>{
			let left = $(e).position().left;
			$(e).css({left: left + ((rankXs[i]-left)/20) });
		});

		canvas2d.clearRect(0, 0, $(canvas).attr("width"), $(canvas).attr("height"));
		for(let r=0; r<rankedTaxa.length; r++) {

			let taxa = rankedTaxa[r].cs;
			let baseLeftOffset = parseFloat($("#container").css("margin-left")) - $("#taxonomy").scrollLeft();
			let baseTopOffset = parseFloat($("#container").css("margin-top")) - $("#taxonomy").scrollTop() + 2;// 2 so it's a little bit below

			for(let t=0; t<taxa.length; t++) {

				let start = document.getElementById(taxa[t]["_id"]);
				let end = document.getElementById(taxa[t]["_supertaxon"]);

				let top = $(start).position().top;
				$(start).css({top: top + ((taxa[t]["target_y"]-top)/20) });

				if(end != undefined){
					canvas2d.beginPath();

					if($(start).hasClass('act')){
						canvas2d.strokeStyle = "rgba(0, 0, 0, 0.6)";
					}else{
						canvas2d.strokeStyle = "rgba(0, 0, 0, 0.3)";
					}

					//TODO flip the start and end
					let startPosition = $(start).position();
					let startParentY = $(start).parent().position().top;
					let startParentX = $(start).parent().parent().position().left;

					let endPosition = $(end).position();
					let endParentY = $(end).parent().position().top;
					let endParentX = $(end).parent().parent().position().left;

					// let ex = startPosition.left - 5 + ranksPosition.left + startParentX - 20;
					// let ey = startPosition.top + 10 + ranksPosition.top + startParentY + 25;
					//
					// let sx = endPosition.left + 130 + ranksPosition.left + endParentX - 20;
					// let sy = endPosition.top + 10 + ranksPosition.top + endParentY + 25;

					let leftOffset = ranksPosition.left + baseLeftOffset;
					let topOffset = ranksPosition.top + baseTopOffset;

					let ex = startPosition.left + startParentX + leftOffset;
					let ey = startPosition.top + startParentY + topOffset;

					let sx = endPosition.left + endParentX + leftOffset + $(end).width() - 20;
					let sy = endPosition.top + endParentY + topOffset;

					canvas2d.moveTo(sx, sy);
					let bx = sx + 45;

					// if the y difference is big, create curve first
					if(Math.abs(ey-sy) > 3){
						canvas2d.bezierCurveTo(bx, sy, sx, ey, bx, ey);
					}else{
						canvas2d.lineTo(bx, ey);
					}

					canvas2d.lineTo(ex, ey);
					canvas2d.stroke();
				}
			}
		}

		animMS--;
		if(animMS == 0){
			clearInterval(taxaAnim);
		}
	}
}

// Rank item class
var RankItem = React.createClass({
  propTypes: {
    _label: React.PropTypes.string.isRequired,
		taxa: React.PropTypes.array
  },

  render: function() {
		return (
			React.createElement('li', {className: 'Rank', key: this.props.key},
        React.createElement('h2', {className: '_label'}, this.props._label),
        React.createElement('ul', {className: 'taxa'},
					this.props.taxa.map(taxon => {return React.createElement
						(
							TaxonItem,
							{
								key: taxon._id,
								_label: taxon._label,
								_id: taxon._id,
								_alternative_labels:taxon._alternative_labels,
								image_wikimedia:taxon.image_wikimedia,
								image_height: taxon.image_height,
								act: taxon.act
							}
						)
					})
				)
      )
		)
  }
});

// Taxon item class
var TaxonItem = React.createClass({
  propTypes: {
    _id: React.PropTypes.string.isRequired,
    _label: React.PropTypes.string.isRequired,
  },

	getSelfTaxon : function(){
		getTaxon(this.props._id);
	},

  render: function() {
		return (
			React.createElement('li', {className: 'Taxon' + (this.props.act===true?' act':''),
																	onClick: this.getSelfTaxon,
																	key: this.props.key,
																	id: this.props._id},
        React.createElement('img', {className: 'image',
																		src:"files/"+(this.props.image_wikimedia!=undefined?this.props.image_wikimedia:'white.png'),
																		width: 100, height: this.props.image_height!=undefined?this.props.image_height:0
																	}),
				React.createElement('div', {className: 'info_container'},
					React.createElement('h3', {className: '_label'}, this.props._label),
					React.createElement('p', {className: '_alternative_labels'}, this.props._alternative_labels)
					// React.createElement('p', {className: '_alternative_labels'}, this.props._id)
	      )
			)
		)
  },
});

// LINEs
// set canvas

let canvas = document.getElementById("line_canvas");
let parent = $(canvas).parent();
$(canvas).attr("width", parent.width());
$(canvas).attr("height", parent.height());
$(canvas).css({top: parent.position().top})
canvas2d = canvas.getContext("2d");
canvas2d.lineWidth = 2;


// var clicked = false, clickY;
// $("#container").on({
//     'mousemove': function(e) {
//         clicked && updateScrollPos(e);
//     },
//     'mousedown': function(e) {
//         clicked = true;
//         clickY = e.pageY;
// 		$('html').css('cursor', 'move');
// 		$('*').css({'-webkit-touch-callout': 'none','-webkit-user-select': 'none','-khtml-user-select': 'none','-moz-user-select': '-moz-none','-ms-user-select': 'none','user-select': 'none'});
//     },
//     'mouseup': function() {
//         clicked = false;
// 		$('html').css('cursor', 'auto');
// 		$('*').css({'-webkit-touch-callout': 'text','-webkit-user-select': 'text','-khtml-user-select': 'text','-moz-user-select': 'text','-ms-user-select': 'text','user-select': 'text'});
// 		$('html').css({'-webkit-touch-callout': 'none','-webkit-user-select': 'none','-khtml-user-select': 'none','-moz-user-select': '-moz-none','-ms-user-select': 'none','user-select': 'none'});
//     }
// });
//
// var updateScrollPos = function(e) {
//     $("#taxonomy").scrollTop($("#taxonomy").scrollTop() + (clickY - e.pageY));
// }

});
