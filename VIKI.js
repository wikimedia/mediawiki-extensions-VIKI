/*
 * Copyright (c) 2014 The MITRE Corporation
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */


window.VIKI = ( function( mw, $, vex, Spinner, d3, my ) {
	/**
	 * @class VikiJS
	 *
	 * Create VikiJS, the core VIKI module.
	 *
	 */
	my.VikiJS = function() {

		/*
		 * Global Constants. Note: all colors except "LIGHT_BLUE" are from flatuicolors.com
		 */
		this.ID = null;
		this.loadingView = null;
		this.WIKI_PAGE_TYPE = 0;
		this.EXTERNAL_PAGE_TYPE = 1;
		this.MAX_BAR_WIDTH = 60;
		this.BAR_HEIGHT = 6;
		this.UNSELECTED_IMAGE_DIMENSION = 25;
		this.THIS_WIKI = "THIS WIKI";
		this.MIN_SCALE = 0.2;
		this.MAX_SCALE = 5;
		this.GRAVITY = 0.2;
		this.LINK_STRENGTH = 1.25;
		this.LINK_OPACITY = 0.2;
		this.HUB_LINK_LENGTH = 400;
		this.LEAF_LINK_LENGTH = 150;
		this.AMETHYST_COLOR = "#9b59b6";
		this.PETER_RIVER_COLOR = "#3498db";
		this.EMERALD_COLOR = "#2ecc71";
		this.SUNFLOWER_COLOR = "#f1c40f";
		this.LIGHT_BLUE = "#23a4ff";
		this.INCOMING_LINK_COLOR = this.PETER_RIVER_COLOR;
		this.OUTGOING_LINK_COLOR = this.SUNFLOWER_COLOR;
		this.BIDIRECTIONAL_LINK_COLOR = this.EMERALD_COLOR;
		this.HIDE_HUB = 0;
		this.HIDE_INCOMING = 1;
		this.HIDE_OUTGOING = 2;

		/*
		 * Mutable Global Variables
		 */
		this.CURRENT_IDENTIFIER = 0;
		this.searchableCount = 0;
		this.contentNamespacesFetched = 0;
		this.initialPageTitles = null;
		this.Hooks = null;
		this.hasHooks = false;
		this.GraphDiv = null;
		this.SubDetailsDiv = null;
		this.ErrorsDiv = null;
		this.SliderDiv = null;
		this.SelectedNodeIndex = null;
		this.Nodes = [];
		this.Links = [];
		this.LinkMap = {};
		this.HiddenNodes = [];
		this.HiddenLinks = [];
		this.Force = null;
		this.LinkSelection = null;
		this.NodeSelection = null;
		this.ImagePath = null;
		this.Zoompos = 1; // to store values for zoom scale
		this.serverURL = mw.config.get( "wgServer" );
		this.myApiURL = this.serverURL + mw.config.get( "wgScriptPath" ) + "/api.php";
		this.allWikis = [];

		var self = this;

		/**
		 * Initialize the VIKI graph.
		 *
		 * Call this method from VikiJS.php to initialize the VIKI graph.
		 *
		 * @param {Array} pageTitles Array of initial page titles to render in the graph.
		 * @param {Array} divs Array of divs to draw the graph components in order:
		 *
		 * - main graph div, where the graph lives
		 * - details div, where the page title and slider live
		 * - slider div, where the slider lives (inside details div)
		 * - errors div, where errors are shown
		 */
		my.VikiJS.prototype.initialize = function( pageTitles, divs, parameters ) {
			var self = this;

			// Parse passed in parameters and initialize div settings.
			// this.ID = this graph div's ID (support for multiple VIKI graphs on one page in the future)
			var allDivs = jQuery.parseJSON( divs );
			var allParameters = jQuery.parseJSON( parameters );

			this.GraphDiv = allDivs[ 0 ];
			this.SubDetailsDiv = allDivs[ 1 ];
			this.SliderDiv = allDivs[ 2 ];
			this.ErrorsDiv = allDivs[ 3 ];
			this.ID = this.GraphDiv.match( new RegExp( "[0-9]", 'g' ) )[ 0 ];
			this.INITIAL_WIDTH = allParameters.width;
			this.INITIAL_HEIGHT = allParameters.height;
			this.height = self.INITIAL_HEIGHT;
			this.width = self.INITIAL_WIDTH;
			this.Hooks = allParameters.hooks;
			this.hasHooks = ( self.Hooks !== null );
			this.serverURL = mw.config.get( "wgServer" );
			this.ImagePath = allParameters.imagePath;
			this.initialPageTitles = jQuery.parseJSON( pageTitles );

			if ( this.initialPageTitles === null ) {
				self.showError( mw.message( 'vikijs-error-missing-pageTitle' )
					.text() );
				return;
			}

			var myLogoURL = allParameters.logoURL;

			// Add this wiki's data to self.allWikis first.
			var thisWikiData = {
				wikiTitle: this.THIS_WIKI,
				apiURL: this.myApiURL,
				contentURL: mw.config.get( "wgServer" ) + mw.config.get( "wgArticlePath" ),
				logoURL: myLogoURL,
				searchableWiki: true
			};

			self.allWikis.push( thisWikiData );

			// Show a placeholder that says "No Node Selected"
			self.displayNoNodeSelected();

			// Set up the slider div.
			self.initializeSliderDiv();

			// Set up the error div.
			self.initializeErrorDiv();

			// Set up the loading spinner
			self.initializeLoadingSpinner();

			// Set up the context menu.
			self.initializeContextMenu();

			// Initialize the D3 graph.
			self.initializeGraph();

			// End of initialization; call the InitializationCompleteHook, then GetAllWikis hook.

			this.callHooks( "InitializationCompleteHook", [] );

			var calledGetAllWikisHook = this.callHooks( "GetAllWikisHook", [] );
			if ( !calledGetAllWikisHook )
				self.hookCompletion( "GetAllWikisHook" );

			// Initialization functions

		};

		/**
		 * Initialize the slider div.
		 *
		 * This method is called internally by initialize().
		 */
		my.VikiJS.prototype.initializeSliderDiv = function() {
			// The details div gets 3/5 of the space, while the slider gets 2/5.
			// The detail-panel width is equal to the input width - size of paddings.
			var margin = 10;
			$( "#" + self.SubDetailsDiv )
				.width( ( self.width - margin ) * 3 / 5 );
			$( "#" + self.SliderDiv )
				.width( ( self.width - margin ) * 2 / 5 );
			$( ".vikijs-detail-panel" )
				.width( self.width - margin );
			// create a new zoom slider
			$( "#" + self.SliderDiv )
				.slider( {
					orientation: "horizontal", //make the slider horizontal
					min: self.MIN_SCALE, // set the lowest value
					max: self.MAX_SCALE, // set the highest value
					step: 0.001, // set the value for each individual increment
					value: self.Zoompos, // set the starting value
					slide: function( event, ui ) {
						// set the zoom scale equal to the current value of the slider
						// which is the current position
						self.Zoompos = ui.value;
						// call the slide function to zoom/pan using the slider
						self.slide();
					}
				} );
		};

		/**
		 * Initialize the error div.
		 *
		 * This method is called internally by initialize().
		 */
		my.VikiJS.prototype.initializeErrorDiv = function() {
			$( "#" + self.ErrorsDiv )
				.append( "<p><strong>" + mw.message( 'vikijs-error-title' )
					.text() + "</strong></p>" );
		};

		/**
		 * Initialize the loading spinner.
		 *
		 * This method is called internally by initialize().
		 */
		my.VikiJS.prototype.initializeLoadingSpinner = function() {
			vex.defaultOptions.className = 'vex-theme-default';

			var loadingContent = '\
<div id="loadingDiv">\
	<div id="textDiv">Loading...</div>\
	<div id="spinnerDiv"></div>\
</div>';

			var loadingStyle = '\
<style>\
	#textDiv {\
		text-align: center;\
	}\
	#spinnerDiv {\
		height: 75px;\
	}\
</style>';

			var opts = {
				lines: 11, // The number of lines to draw
				length: 8, // The length of each line
				width: 4, // The line thickness
				radius: 8, // The radius of the inner circle
				corners: 1, // Corner roundness (0..1)
				rotate: 0, // The rotation offset
				direction: 1, // 1: clockwise, -1: counterclockwise
				color: '#000', // #rgb or #rrggbb or array of colors
				speed: 1, // Rounds per second
				trail: 60, // Afterglow percentage
				shadow: false, // Whether to render a shadow
				hwaccel: false, // Whether to use hardware acceleration
				className: 'spinner', // The CSS class to assign to the spinner
				zIndex: 2e9, // The z-index (defaults to 2000000000)
				top: '60%', // Top position relative to parent
				left: '50%' // Left position relative to parent
			};

			self.loadingView = vex.open( {
				content: loadingContent,
				contentCSS: {
					width: '150px'
				},
				afterOpen: function( $vexContent ) {
					$vexContent.append( loadingStyle );
					new Spinner( opts )
						.spin( document.getElementById( 'spinnerDiv' ) );
				},
				showCloseButton: false
			} );
		};

		/**
		 * Initialize the context menu.
		 *
		 * This method is called internally by initialize().
		 */
		my.VikiJS.prototype.initializeContextMenu = function() {
			// Ensure the background graph div doesn't trigger context menu - only nodes and the covering rect.

			$( '#' + self.GraphDiv )
				.on( 'contextmenu', function() {
					return false;
				} );

			$( 'body' )
				.append(
					"<div class=\"contextMenu\" id=\"viki_menu-" + self.ID + "\"><ul>" +
					// the dynamic menu title (node name)
					"<li id=\"viki_name-" + self.ID + "\"  class=\"header\" style=\"text-align: center; font-weight: bold;\">Options</li>" +
					"<hr>" + // separator
					// actual navigable menu
					"<div class=\"options\" >" +
					"<li id=\"freeze\" class=\"viki_freeze-" + self.ID + "\">Freeze</li>" +
					"<li id=\"getinfo\" >Visit Page</li>" +
					"<li id=\"elaborate\" class=\"viki_elaborate-" + self.ID + "\">Elaborate</li>" +
					"<li id=\"categories\">Show Categories</li>" +
					"<hr>" + // separator
					"<li id=\"hide\">Hide Node</li>" +
					"<li id=\"hideHub\">Hide Hub</li>" +
					"<li id=\"hideByCategory\">Hide By Category</li>" +
					"<li id=\"hideIncoming\">Hide Incoming Links</li>" +
					"<li id=\"hideOutgoing\">Hide Outgoing Links</li>" +
					"<hr>" + // separator
					"<li id=\"showall\">Show All</li>" +
					"</ul></div></div>"
				);

			$( 'body' )
				.append(
					"<div class=\"contextMenu\" id=\"viki_backgroundMenu-" + self.ID + "\"><ul>" +
					"<li id=\"viki_backgroundMenu-" + self.ID + "\" class=\"header\" style=\"text-align: center; font-weight: bold;\">Options</li>" +
					"<hr>" +
					"<div class=\"options\">" +
					"<li id=\"showall\">Show All</li>" +
					"</ul></div></div>"
				);

			$( "#name" )
				.css( "text-align", "center" );
		};

		/**
		 * Initialize D3 graph.
		 *
		 * This method is called internally by initialize().
		 */
		my.VikiJS.prototype.initializeGraph = function() {
			function tick() {

				// Explicit detection for IE10 and IE11, which requires this patch to fix SVG markers.
				// See:
				// http://stackoverflow.com/questions/15588478/internet-explorer-10-not-showing-svg-path-d3-js-graph
				// http://stackoverflow.com/questions/17447373/how-can-i-target-only-internet-explorer-11-with-javascript
				if ( ( navigator.appVersion.indexOf( "MSIE 10" ) !== -1 ) ||
					( !!navigator.userAgent.match( /Trident.*rv[ :]*11\./ ) ) )
					self.LinkSelection.each( function() {
						this.parentNode.insertBefore( this, this );
					} );

				self.NodeSelection.attr( "transform", function( d ) {
					return "translate(" + d.x + "," + d.y + ")";
				} );

				// rather than return the (x,y) of the source and target node directly,
				// which would cause the links to stab through the node text,
				// we create an imaginary parabola around the node (a, b = node width, height)
				// and make the links connect to points on this parabola which would extend
				// the line into the center of the node, if possible.
				// (x,y) depend on (r, theta) and because this is an ellipse, r is a function of
				// a, b, and theta.

				self.LinkSelection.attr( "x1", function( d ) {

					var dy = d.target.y - d.source.y;
					var dx = d.target.x - d.source.x;
					var angle = Math.atan2( dy, dx );
					var width = d.source.nodeWidth;
					var height = d.source.nodeHeight;

					var a = width / 2;
					var b = height / 2;

					// value of r is from wikipedia article on ellipses: r as a function of theta, a, b.
					var r = a * b / Math.sqrt( ( b * b * Math.cos( angle ) * Math.cos( angle ) ) + ( a * a * Math.sin( angle ) * Math.sin( angle ) ) );

					return d.source.x + r * Math.cos( angle );
				} );

				self.LinkSelection.attr( "y1", function( d ) {

					var dy = d.target.y - d.source.y;
					var dx = d.target.x - d.source.x;
					var angle = Math.atan2( dy, dx );
					var width = d.source.nodeWidth;
					var height = d.source.nodeHeight;

					var a = width / 2;
					var b = height / 2;

					var r = a * b / Math.sqrt( ( b * b * Math.cos( angle ) * Math.cos( angle ) ) + ( a * a * Math.sin( angle ) * Math.sin( angle ) ) );

					return d.source.y + r * Math.sin( angle );
				} );

				self.LinkSelection.attr( "x2", function( d ) {

					var dy = d.target.y - d.source.y;
					var dx = d.target.x - d.source.x;
					var angle = Math.atan2( dy, dx );
					var width = d.target.nodeWidth;
					var height = d.target.nodeHeight;

					var a = width / 2;
					var b = height / 2;

					var r = a * b / Math.sqrt( ( b * b * Math.cos( Math.PI + angle ) * Math.cos( Math.PI + angle ) ) + ( a * a * Math.sin( Math.PI + angle ) * Math.sin( Math.PI + angle ) ) );

					return d.target.x + r * Math.cos( Math.PI + angle );
				} );

				self.LinkSelection.attr( "y2", function( d ) {

					var dy = d.target.y - d.source.y;
					var dx = d.target.x - d.source.x;
					var angle = Math.atan2( dy, dx );
					var width = d.target.nodeWidth;
					var height = d.target.nodeHeight;

					var a = width / 2;
					var b = height / 2;

					var r = a * b / Math.sqrt( ( b * b * Math.cos( Math.PI + angle ) * Math.cos( Math.PI + angle ) ) + ( a * a * Math.sin( Math.PI + angle ) * Math.sin( Math.PI + angle ) ) );
					return d.target.y + r * Math.sin( Math.PI + angle );
				} );
			}

			self.zoom = d3.behavior.zoom()
				.on( "zoom", self.redrawZoom )
				.scaleExtent( [ self.MIN_SCALE, self.MAX_SCALE ] );

			var svg = d3.select( "#" + self.GraphDiv )
				.append( "svg:svg" )
				.attr( "width", self.width )
				.attr( "height", self.height )
				.attr( "id", "viki_" + self.ID )
				.attr( "pointer-events", "all" )
				.append( "svg:g" )
				.call( self.zoom )
				.on( "dblclick.zoom", null );

			svg.append( "svg:rect" )
				.attr( "id", "viki_rect-" + self.ID )
				.attr( "width", self.width )
				.attr( "height", self.height )
				.attr( "fill", "white" );

			svg.append( "svg:g" )
				.attr( "id", "viki_moveable-" + self.ID );

			var defs = svg.append( "defs" );

			defs.append( "marker" )
				.attr( "id", "arrowHeadOutgoing" )
				.attr( "viewBox", "0 -8 20 20" )
				.attr( "refX", 16 )
				.attr( "refY", 0 )
				.attr( "markerWidth", 12 )
				.attr( "markerHeight", 12 )
				.attr( "markerUnits", "userSpaceOnUse" )
				.attr( "orient", "auto" )
				.attr( "fill", self.OUTGOING_LINK_COLOR )
				.attr( "stroke-width", "2" )
				.append( "path" )
				.attr( "d", "M0,-8L20,0L0,8" );

			defs.append( "marker" )
				.attr( "id", "arrowHeadIncoming" )
				.attr( "viewBox", "0 -8 20 20" )
				.attr( "refX", 16 )
				.attr( "refY", 0 )
				.attr( "markerWidth", 12 )
				.attr( "markerHeight", 12 )
				.attr( "markerUnits", "userSpaceOnUse" )
				.attr( "orient", "auto" )
				.attr( "fill", self.INCOMING_LINK_COLOR )
				.attr( "stroke-width", "2" )
				.append( "path" )
				.attr( "d", "M0,-8L20,0L0,8" );

			defs.append( "marker" )
				.attr( "id", "arrowHeadBidirectional" )
				.attr( "viewBox", "0 -8 20 20" )
				.attr( "refX", 16 )
				.attr( "refY", 0 )
				.attr( "markerWidth", 12 )
				.attr( "markerHeight", 12 )
				.attr( "markerUnits", "userSpaceOnUse" )
				.attr( "orient", "auto" )
				.attr( "fill", self.BIDIRECTIONAL_LINK_COLOR )
				.attr( "stroke-width", "2" )
				.append( "path" )
				.attr( "d", "M0,-8L20,0L0,8" );

			defs.append( "marker" )
				.attr( "id", "arrowHeadBlack" )
				.attr( "viewBox", "0 -8 20 20" )
				.attr( "refX", 16 )
				.attr( "refY", 0 )
				.attr( "markerWidth", 12 )
				.attr( "markerHeight", 12 )
				.attr( "markerUnits", "userSpaceOnUse" )
				.attr( "orient", "auto" )
				.attr( "fill", "black" )
				.attr( "stroke-width", "2" )
				.append( "path" )
				.attr( "d", "M0,-8L20,0L0,8" );

			defs.append( "marker" )
				.attr( "id", "backArrowHeadBidirectional" )
				.attr( "viewBox", "-20 -8 20 20" )
				.attr( "refX", -16 )
				.attr( "refY", 0 )
				.attr( "markerWidth", 12 )
				.attr( "markerHeight", 12 )
				.attr( "markerUnits", "userSpaceOnUse" )
				.attr( "orient", "auto" )
				.attr( "fill", self.BIDIRECTIONAL_LINK_COLOR )
				.attr( "stroke-width", "2" )
				.append( "path" )
				.attr( "d", "M0,-8L-20,0L0,8" );

			defs.append( "marker" )
				.attr( "id", "backArrowHeadBlack" )
				.attr( "viewBox", "-20 -8 20 20" )
				.attr( "refX", -16 )
				.attr( "refY", 0 )
				.attr( "markerWidth", 12 )
				.attr( "markerHeight", 12 )
				.attr( "markerUnits", "userSpaceOnUse" )
				.attr( "orient", "auto" )
				.attr( "fill", "black" )
				.attr( "stroke-width", "2" )
				.append( "path" )
				.attr( "d", "M0,-8L-20,0L0,8" );

			d3.select( "#viki_moveable-" + self.ID )
				.append( "svg:g" )
				.attr( "id", "viki_links-" + self.ID );
			d3.select( "#viki_moveable-" + self.ID )
				.append( "svg:g" )
				.attr( "id", "viki_nodes-" + self.ID );

			self.Force = d3.layout.force();
			self.Force.gravity( self.GRAVITY );
			self.Force.linkStrength( self.LINK_STRENGTH );
			// link distance was made dynamic in respect to the increase in charge. As the nodes form a cluster, the edges are less likely to cross.
			// The edge between to clusters is stretched from the polarity between the adjacent clusters.
			self.Force.linkDistance(
				function( n ) {
					// if the source and target has been elaborated, set the variable child to true
					var child = ( n.source.elaborated && n.target.elaborated );
					if ( child ) {
						return self.HUB_LINK_LENGTH;
					} // if this node is the parent or the center of a cluster of nodes
					else {
						return self.LEAF_LINK_LENGTH;
					} // if this node is the child or the outer edge of a cluster of nodes

				}
			);
			// Original value of charge was -3000. Increasing the charge maximizes polarity between nodes causing each node to repel.
			// This will decrease edge crossings for the nodes.
			self.Force.charge( -7500 );
			self.Force.friction( 0.675 );
			self.Force.size( [ self.width, self.height ] );
			self.Force.on( "tick", tick );

			self.LinkSelection =
				svg.select( "#viki_links-" + self.ID )
				.selectAll( ".viki_link-" + self.ID );

			self.NodeSelection =
				svg.select( "#viki_nodes-" + self.ID )
				.selectAll( ".viki_node-" + self.ID );

		};

		/**
		 * Fetch content namespaces for all wikis.
		 *
		 * This method is called internally at the end of VikiJS.initialize() to fetch content namespaces for all wikis in this.allWikis.
		 */
		my.VikiJS.prototype.fetchContentNamespaces = function() {
			var self = this;

			var actuallySearchableWikis = self.allWikis.filter( function( wiki ) {
				return wiki.searchableWiki;
			} );

			self.searchableCount = actuallySearchableWikis.length;

			if ( self.searchableCount === 0 ) {
				self.populateInitialGraph();
			} else
				for ( var i = 0; i < actuallySearchableWikis.length; i++ ) {
					self.getContentNamespacesForWikiAtIndex( actuallySearchableWikis, i );
				}
		};

		/**
		 * Get content namespaces for wiki at index for this.allWikis.
		 *
		 * This method is called internally by fetchContentNamespaces.
		 *
		 * @param {Array} actuallySearchableWikis Array of searchable wikis.
		 * @param {number} index index of wiki in actuallySearchableWikis.
		 */
		my.VikiJS.prototype.getContentNamespacesForWikiAtIndex = function( actuallySearchableWikis, index ) {
			var self = this;
			var wiki = actuallySearchableWikis[ index ];
			var wikiTitle = wiki.wikiTitle;

			var sameServer = wiki.contentURL.indexOf( self.serverURL ) > -1;
			jQuery.ajax( {
				url: wiki.apiURL,
				dataType: sameServer ? 'json' : 'jsonp',
				data: {
					action: 'getContentNamespaces',
					format: 'json',
					redirects: 'true'
				},
				timeout: 5000,
				success: function( data ) {
					if ( data.error && data.error.code && data.error.code === "unknown_action" ) {
						actuallySearchableWikis[ index ].contentNamespaces = [ 0 ];
					} else {
						actuallySearchableWikis[ index ].contentNamespaces = data.getContentNamespaces;
					}

					self.contentNamespacesFetched++;
					if ( self.contentNamespacesFetched === self.searchableCount ) {
						self.populateInitialGraph();
					}

				},
				error: function( jqXHR, textStatus, errorThrown ) {
					if ( errorThrown === 'timeout' ) {
						// do something about this error, but then increment contentNamespacesFetched so it can continue to work.
						// default to just NS 0 (main).
						self.showError( mw.message( 'vikijs-timeout-content-namespace', wikiTitle )
							.text() );
					} else {
						self.showError( mw.message( 'vikijs-error-content-namespace', wikiTitle )
							.text() );
					}
					actuallySearchableWikis[ index ].contentNamespaces = [ 0 ];
					self.contentNamespacesFetched++;
					if ( self.contentNamespacesFetched === self.searchableCount ) {
						self.populateInitialGraph();
					}
				}
			} );

		};

		/**
		 * Perform initial graph population.
		 *
		 * This method is called internally after all content namespaces are fetched.
		 * It adds all pages from the initial pageTitles array, and then elaborates these pages.
		 */
		my.VikiJS.prototype.populateInitialGraph = function() {
			var self = this;

			vex.close( self.loadingView.data()
				.vex.id );

			for ( var i = 0; i < self.initialPageTitles.length; i++ ) {
				var node = self.createWikiNodeFromWiki( self.initialPageTitles[ i ], self.THIS_WIKI );
				self.addNode( node );
				self.visitNode( node );
			}

			for ( i = 0; i < self.initialPageTitles.length; i++ )
				self.elaborateWikiNode( self.Nodes[ i ] );

			self.Force.nodes( self.Nodes );
			self.Force.links( self.Links );

			self.redraw( true );

			// after initial population, by default select the first node.
			self.SelectedNodeIndex = 0;
			self.displayNodeInfo( self.Nodes[ 0 ] );
			self.redrawNode( self.Nodes[ 0 ] );

		};

		/*
		 * Graph Display and D3 Functions
		 */

		/**
		 * Redraw the graph.
		 *
		 * Call this method in response to any changes to the underlying data in the graph,
		 * for example new pages being added, or plugin functions which modify the page title.
		 *
		 * @param {boolean} restartGraph determine whether to reheat the D3 graph, causing the nodes to re-position.
		 */
		my.VikiJS.prototype.redraw = function( restartGraph ) {
			var self = this;

			self.NodeSelection =
				self.NodeSelection.data( self.Nodes, function( d ) {
					return d.identifier;
				} );
			self.LinkSelection =
				self.LinkSelection.data( self.Links );

			var newNodes = self.NodeSelection.enter()
				.append( "svg:g" );

			self.NodeSelection.exit()
				.remove();
			self.LinkSelection.exit()
				.remove();

			newNodes.attr( "class", "vikijs-node viki_node-" + this.ID );

			newNodes.on( "click", function( d ) {
				self.SelectedNodeIndex = d.index;
				self.displayNodeInfo( d );
				self.redraw( false );
			} );
			newNodes.on( "dblclick", function( d ) {
				d.fixed = !d.fixed;
			} );

			newNodes.on( "contextmenu", function( d ) {
				self.SelectedNodeIndex = d.index;
				self.redraw( false );
			} );

			self.prepareContextMenus();

			self.Force.drag()
				.on( "dragstart", function() {
					d3.event.sourceEvent.stopPropagation();
				} );

			newNodes.call( self.Force.drag );

			var newToolTips = newNodes.append( "svg:title" );
			newToolTips.attr( "class", "tooltip" );
			var allToolTips = d3.selectAll( ".tooltip" );
			allToolTips.text( function( d ) {
				return d.fullDisplayName;
			} );

			var newLabels = newNodes.append( "svg:text" );
			newLabels.text( function( d ) {
					return d.displayName;
				} )
				.attr( "text-anchor", "middle" )
				.attr( "dy", ".25em" ) // see bost.ocks.org/mike/d3/workshop/#114
				.attr( "dx", 1 * self.UNSELECTED_IMAGE_DIMENSION / 2 )
				.each( function() {
					var textbox = this.getBBox();

					var node = d3.select( this.parentNode )
						.datum();
					node.nodeWidth = textbox.width + self.UNSELECTED_IMAGE_DIMENSION + 10; // the 2 is a magic number to improve appearance
					node.nodeHeight = Math.max( textbox.height, self.UNSELECTED_IMAGE_DIMENSION ) + 5;
				} );

			var texts = self.NodeSelection.select( "text" );
			texts.text( function( d ) {
				return d.displayName;
			} );

			texts.each( function() {
				var textbox = this.getBBox();
				var node = d3.select( this.parentNode )
					.datum();
				node.nodeWidth = textbox.width + self.UNSELECTED_IMAGE_DIMENSION + 10;
				node.nodeHeight = Math.max( textbox.height, self.UNSELECTED_IMAGE_DIMENSION ) + 5;
			} );

			texts.attr( "font-weight", function( d ) {
				return d.index === self.SelectedNodeIndex ? "bold" : "normal";
			} );
			texts.attr( "fill", function( d ) {
				// return d.nonexistentPage ? "red" : "black";
				if ( d.nonexistentPage )
					return "red";
				else if ( !d.searchable )
					return "grey";
				else
					return "black";
			} );

			var newImages = newNodes.append( "svg:image" );
			newImages.attr( "class", "vikijs-icon icon" );

			var allImages = self.NodeSelection.selectAll( ".icon" );

			allImages.attr( "xlink:href", function( d ) {
				// go through the hierarchy of possible icons in order of preference
				// Hook Icons > Site Logo Icons > External Node Icons > info.png

				if ( d.hookIconURL )
					return d.hookIconURL;
				else if ( d.logoURL )
					return d.logoURL;
				else if ( d.externalNodeIconURL )
					return d.externalNodeIconURL;
				else
					return self.ImagePath + "info.png";
			} );
			allImages
				.attr( "x", function() {
					var textbox = d3.select( this.parentNode )
						.select( "text" )
						.node()
						.getBBox();
					var nodeWidth = textbox.width + self.UNSELECTED_IMAGE_DIMENSION;
					return -1 * nodeWidth / 2 - 2; // this -2 is a magic number
				} )
				.attr( "y", function() {
					return -1 * self.UNSELECTED_IMAGE_DIMENSION / 2;
				} )
				.attr( "width", self.UNSELECTED_IMAGE_DIMENSION )
				.attr( "height", self.UNSELECTED_IMAGE_DIMENSION );

			var newLinks = self.LinkSelection.enter()
				.append( "svg:line" );
			newLinks.attr( "class", "viki_link-" + this.ID );
			self.LinkSelection.style( "stroke-width", function( d ) {
				if ( typeof d.source.index !== 'undefined' ) {
					return d.source.index === self.SelectedNodeIndex ||
						d.target.index === self.SelectedNodeIndex ? 2 : 1;
				} else {
					return d.source === self.Nodes[ self.SelectedNodeIndex ] ||
						d.target === self.Nodes[ self.SelectedNodeIndex ] ? 2 : 1;
				}
			} );
			self.LinkSelection.style( "opacity", function( d ) {
				if ( typeof d.source.index !== 'undefined' ) {
					return d.source.index === self.SelectedNodeIndex ||
						d.target.index === self.SelectedNodeIndex ? 1 : self.LINK_OPACITY;
				} else {
					return d.source === self.Nodes[ self.SelectedNodeIndex ] ||
						d.target === self.Nodes[ self.SelectedNodeIndex ] ? 1 : self.LINK_OPACITY;
				}
			} );
			self.LinkSelection.style( "stroke", function( d ) {
				if ( typeof d.source.index !== 'undefined' ) {
					if ( d.source.index === self.SelectedNodeIndex )
						return d.bidirectional ? self.BIDIRECTIONAL_LINK_COLOR : self.OUTGOING_LINK_COLOR;
					else if ( d.target.index === self.SelectedNodeIndex )
						return d.bidirectional ? self.BIDIRECTIONAL_LINK_COLOR : self.INCOMING_LINK_COLOR;
					else return "black";
				} else {
					if ( d.source === self.Nodes[ self.SelectedNodeIndex ] )
						return d.bidirectional ? self.BIDIRECTIONAL_LINK_COLOR : self.OUTGOING_LINK_COLOR;
					else if ( d.target === self.Nodes[ self.SelectedNodeIndex ] )
						return d.bidirectional ? self.BIDIRECTIONAL_LINK_COLOR : self.INCOMING_LINK_COLOR;
					else return "black";
				}

			} );
			self.LinkSelection.attr( "marker-end", function( d ) {
				if ( typeof d.source.index !== 'undefined' ) {
					if ( d.source.index === self.SelectedNodeIndex )
						return d.bidirectional ? "url(#arrowHeadBidirectional)" : "url(#arrowHeadOutgoing)";
					else if ( d.target.index === self.SelectedNodeIndex )
						return d.bidirectional ? "url(#arrowHeadBidirectional)" : "url(#arrowHeadIncoming)";
					else return "url(#arrowHeadBlack)";
				} else {
					if ( d.source === self.Nodes[ self.SelectedNodeIndex ] )
						return d.bidirectional ? "url(#arrowHeadBidirectional)" : "url(#arrowHeadOutgoing)";
					else if ( d.target === self.Nodes[ self.SelectedNodeIndex ] )
						return d.bidirectional ? "url(#arrowHeadBidirectional)" : "url(#arrowHeadIncoming)";
					else return d.bidirectional ? "url(#arrowHeadBidirectional)" : "url(#arrowHeadBlack)";
				}
			} );

			self.LinkSelection.attr( "marker-start", function( d ) {
				if ( d.bidirectional ) {
					if ( typeof d.source.index !== 'undefined' ) {
						return d.source.index === self.SelectedNodeIndex || d.target.index === self.SelectedNodeIndex ? "url(#backArrowHeadBidirectional)" : "url(#backArrowHeadBlack)";
					} else {
						return d.source === self.Nodes[ self.SelectedNodeIndex ] || d.target === self.Nodes[ self.SelectedNodeIndex ] ? "url(#backArrowHeadBidirectional)" : "url(#backArrowHeadBlack)";
					}
				}
			} );

			if ( restartGraph ) {
				self.Force.start();
			}

		};

		/**
		 * Redraw an individual node.
		 *
		 * Call this method in response to changes to the underlying data of one single node in the graph,
		 * for example plugin functions which modify the page title. This method has better performance
		 * than redraw for large graphs.
		 *
		 * @param {Object} node the node to be redrawn.
		 */
		my.VikiJS.prototype.redrawNode = function( node ) {
			// nodeSelection is a selection of one, but it's easier to still behave as a selection.

			var nodeSelection = self.NodeSelection.filter( function( d ) {
				return d === node;
			} );

			var toolTip = nodeSelection.select( ".tooltip" );
			toolTip.text( node.fullDisplayName );

			var text = nodeSelection.select( "text" );
			text.text( node.displayName );

			text.each( function() {
				var textbox = this.getBBox();
				node.nodeWidth = textbox.width + self.UNSELECTED_IMAGE_DIMENSION + 10;
				node.nodeHeight = Math.max( textbox.height, self.UNSELECTED_IMAGE_DIMENSION ) + 5;
			} );

			text.attr( "font-weight", function( d ) {
				return d.index === self.SelectedNodeIndex ? "bold" : "normal";
			} );

			text.attr( "fill", function( d ) {
				if ( d.nonexistentPage )
					return "red";
				else if ( !d.searchable )
					return "grey";
				else
					return "black";
			} );

			var image = nodeSelection.select( ".icon" );
			image.attr( "xlink:href", function( d ) {
					// go through the hierarchy of possible icons in order of preference
					// Hook Icons > Site Logo Icons > External Node Icons > info.png

					if ( d.hookIconURL )
						return d.hookIconURL;
					else if ( d.logoURL )
						return d.logoURL;
					else if ( d.externalNodeIconURL )
						return d.externalNodeIconURL;
					else
						return self.ImagePath + "info.png";
				} )
				.attr( "x", function() {
					var textbox = d3.select( this.parentNode )
						.select( "text" )
						.node()
						.getBBox();
					var nodeWidth = textbox.width + self.UNSELECTED_IMAGE_DIMENSION;
					return -1 * nodeWidth / 2 - 2; // this -2 is a magic number
				} )
				.attr( "y", function() {
					return -1 * self.UNSELECTED_IMAGE_DIMENSION / 2;
				} )
				.attr( "width", self.UNSELECTED_IMAGE_DIMENSION )
				.attr( "height", self.UNSELECTED_IMAGE_DIMENSION );
		};

		/**
		 * Set up the context menu for nodes.
		 *
		 * This method is called in redraw() to prepare the context menu for newly added nodes.
		 */
		my.VikiJS.prototype.prepareContextMenus = function() {
			var self = this;

			$( '#viki_rect-' + self.ID )
				.contextMenu( 'viki_backgroundMenu-' + this.ID, {
					onShowMenu: function( e, menu ) {
						self.Force.stop();
						return menu;
					},
					onExitMenu: function() {
						self.Force.start();
					},
					itemStyle: {
						fontFamily: 'sans serif',
						fontSize: '13px',
						backgroundColor: '#FFFFFF'
					},
					menuStyle: {
						width: '80px'
					},
					bindings: {
						'showall': function() {
							self.showAllNodes();
						}
					}
				} );

			$( '.viki_node-' + self.ID )
				.contextMenu( 'viki_menu-' + this.ID, {
					// activate before the menu shows
					onShowMenu: function( e, menu ) {
						self.Force.stop();
						// find the node according to the index and set it locally
						var node = self.findNode( 'index', self.SelectedNodeIndex );
						if ( typeof node.fix === 'undefined' )
							node.fix = false;
						//var node = this.findNode('index',this.SelectedNodeIndex, this);
						// create a json object to store the variable settings
						var freeze = {
							toggle: "",
							fix: false
						};

						// if the node has been fixed, then display "unfreeze" as a menu
						// option and if unfreeze is selected, unfreeze the node
						// note: the weird syntax here is due to some strange issue with
						// node.fixed taking on integer values instead of true/false
						// after they have been moused over at some point.

						freeze.fix = node.fix ? false : true;
						freeze.toggle = node.fix ? "Unfreeze" : "Freeze";

						// set the title of the menu to the name
						$( '#viki_name-' + self.ID )
							.html( node.displayName );
						// toggle the menu option between freeze and unfreeze
						$( '.viki_freeze-' + self.ID )
							.html( node.fix ? 'Unfreeze' : 'Freeze' );
						// the actual menu code

						if ( node.elaborated || node.type === self.EXTERNAL_PAGE_TYPE || node.nonexistentPage || ( node.type === self.WIKI_PAGE_TYPE && !node.searchable ) ) {
							$( '.viki_elaborate-' + self.ID, menu )
								.remove();
						}
						if ( !node.elaborated ) {
							$( '#hideHub', menu )
								.remove();
							$( '#hideIncoming', menu )
								.remove();
							$( '#hideOutgoing', menu )
								.remove();
						}
						if ( node.nonexistentPage ) {
							$( '#getinfo', menu )
								.remove();
							$( '#categories', menu )
								.remove();
							$( '#hideByCategory', menu )
								.remove();
						}
						if ( node.type === self.EXTERNAL_PAGE_TYPE ) {
							$( '#categories', menu )
								.remove();
							$( '#hideByCategory', menu )
								.remove();
						}
						if ( node.hidingOutgoing ) {
							$( '#hideOutgoing', menu )
								.remove();
						}
						if ( node.hidingIncoming ) {
							$( '#hideIncoming', menu )
								.remove();
						}
						return menu;
					},
					// activate after the menu shows
					onExitMenu: function() {
						self.Force.start();
					},
					// style the menu
					itemStyle: {
						fontFamily: 'sans serif',
						fontSize: '13px',
						backgroundColor: '#FFFFFF'
					},
					bindings: {
						'freeze': function( t ) {
							var node = d3.select( t )
								.datum();

							if ( typeof node.fix === 'undefined' )
								node.fix = false;

							node.fixed = !node.fix;
							node.fix = !node.fix;
						},
						'getinfo': function( t ) {
							var node = d3.select( t )
								.datum();
							window.open( node.URL, "_blank" );
						},
						'elaborate': function() {
							self.elaborateNodeAtIndex( self.SelectedNodeIndex );
						},
						'categories': function( t ) {
							var node = d3.select( t )
								.datum();
							self.showCategories( node.categories, false );
						},
						'hideByCategory': function( t ) {
							var node = d3.select( t )
								.datum();
							self.showCategories( node.categories, true );
						},
						'hideIncoming': function( t ) {
							var node = d3.select( t )
								.datum();
							self.hideIncomingLinks( node );
						},
						'hideOutgoing': function( t ) {
							var node = d3.select( t )
								.datum();
							self.hideOutgoingLinks( node );
						},
						'hide': function( t ) {
							var node = d3.select( t )
								.datum();
							self.hideNodeAndRedraw( node );
						},
						'hideHub': function( t ) {
							var node = d3.select( t )
								.datum();
							self.hideHub( node );
						},
						'showall': function() {
							self.showAllNodes();
						}
					}
				} );

		};

		/**
		 * Slide event for the zoom slider.
		 *
		 * This method is called internally in response to a zoom slider event.
		 */
		my.VikiJS.prototype.slide = function() {

			// set targetZoom to the logged zoom position
			var targetZoom = this.Zoompos;
			// calculate the center of the graph by dividing the width and height by two
			var center = [ this.width / 2, this.height / 2 ];
			// set the scale extent
			var extent = this.zoom.scaleExtent();
			// and the translation vectors
			var translate = this.zoom.translate();
			var translation = [];
			var l = [];
			// setup a json object with the translation x and y values with the zoom scale
			var view = {
				x: translate[ 0 ],
				y: translate[ 1 ],
				k: this.zoom.scale()
			};

			if ( targetZoom < extent[ 0 ] || targetZoom > extent[ 1 ] ) {
				return false;
			}

			translation = [ ( center[ 0 ] - view.x ) / view.k, ( center[ 1 ] - view.y ) / view.k ];
			view.k = targetZoom;
			// generate the translation calculations by multiplying a transition value with the zoom value
			// and adding the appropriate view value
			l = [ translation[ 0 ] * view.k + view.x, translation[ 1 ] * view.k + view.y ];
			// set the view x and y values ( the pan x and pan y) equal to the center values
			// minus the transition calculations
			view.x += center[ 0 ] - l[ 0 ];
			view.y += center[ 1 ] - l[ 1 ];
			// now that the values have been calculated, call the controls and zoom
			this.interpolateZoom( [ view.x, view.y ], view.k );

		};

		/**
		 * Set the zoom setting in response to the zoom slider.
		 *
		 * This method is called internally from slide().
		 *
		 * @param {Array} translate the translation array
		 * @param {number} scale the zoom scale
		 */
		my.VikiJS.prototype.interpolateZoom = function( translate, scale ) {
			var self = this;
			// zoom with the set scale and translation values
			return d3.transition()
				.duration( 50 )
				.tween( "zoom", function() {
					var iTranslate = d3.interpolate( self.zoom.translate(), translate ),
						iScale = d3.interpolate( self.zoom.scale(), scale );
					return function( t ) {
						self.zoom
							.scale( iScale( t ) )
							.translate( iTranslate( t ) );
						self.zoomed();
					};
				} );
		};
		/**
		 * Redraw the graph in response to a slider event.
		 *
		 * This method is called internally from interpolateZoom() after a zoom event.
		 */
		my.VikiJS.prototype.zoomed = function() {
			var self = this;
			// access the element movable and move to the scale and translation vectors
			d3.select( "#viki_moveable-" + this.ID )
				.attr( "transform",
					"translate(" + self.zoom.translate() + ")" +
					"scale(" + self.zoom.scale() + ")"
				);
		};

		/**
		 * Redraw the graph in response to a mousewheel event.
		 *
		 * This method is called internally.
		 *
		 */
		my.VikiJS.prototype.redrawZoom = function() {
			self.Zoompos = d3.event.scale;
			d3.select( "#viki_moveable-" + self.ID )
				.attr( "transform", "translate(" + d3.event.translate + ")" + " scale(" + self.Zoompos + ")" );
			// if you scroll via a scrollwheel inside the graph, then set the slider to the current scale
			$( "#" + self.SliderDiv )
				.slider( "value", self.Zoompos );
		};

		/**
		 * Display the node title and any other relevant information.
		 *
		 * This method is called internally whenever a different node is selected.
		 *
		 * @param {Object} node The node whose information is to be displayed.
		 */
		my.VikiJS.prototype.displayNodeInfo = function( node ) {
			var self = this;

			if ( self.SelectedNodeIndex !== node.index ) {
				return;
			}

			var info = "<h4 id='vikijs-header'>";

			info += node.fullDisplayName;

			if ( node.nonexistentPage )
				info += " (Page Does Not Exist)";
			if ( node.type === self.WIKI_PAGE_TYPE && !node.searchable )
				info += " (Page Cannot Be Elaborated)";

			info += "</h4>";

			jQuery( "#" + self.SubDetailsDiv )
				.html( info );
		};

		/**
		 * Display "No Node Selected" in the detail section when no node is selected.
		 *
		 * This method is called internally whenever no node is selected.
		 */
		my.VikiJS.prototype.displayNoNodeSelected = function() {
			var self = this;

			var info = "<h4 id='vikijs-header'>(No Node Selected)</h4>";
			jQuery( "#" + self.SubDetailsDiv )
				.html( info );
		};

		/**
		 * Make an API call to get information about this node.
		 *
		 * This method is called internally whenever a new node is added to the graph,
		 * in order to verify its existence and collect other information about this page.
		 *
		 * @param {Object} intraNode The node being visited.
		 */
		my.VikiJS.prototype.visitNode = function( intraNode ) {
			var self = this;
			// note: beyond modularity, this is a separate function to preserve the scope of intraNode for the ajax call.

			self.callHooks( "BeforeVisitNodeHook", [ intraNode ] );

			if ( intraNode.visited )
				return;

			jQuery.ajax( {
				url: intraNode.apiURL,
				dataType: intraNode.sameServer ? 'json' : 'jsonp',
				data: {
					action: 'query',
					prop: 'categories',
					titles: intraNode.pageTitle,
					format: 'json',
					redirects: 'true'
				},
				success: function( data, textStatus, jqXHR ) {
					wikiPageCheckSuccessHandler( data, textStatus, jqXHR, intraNode );
				},
				error: function() {
					self.showError( mw.message( 'vikijs-error-visit-node', intraNode.pageTitle )
						.text() );
				}
			} );
			intraNode.visited = true;

			function wikiPageCheckSuccessHandler( data, textStatus, jqXHR, originNode ) {

				if ( data.query.pages[ "-1" ] ) {
					// check if the page is nonexistent
					originNode.nonexistentPage = true;
					self.redrawNode( originNode );
				} else {
					// if originNode doesn't already have a categories array, make one
					if ( !originNode.categories )
						originNode.categories = [];

					// get the categories
					var page = data.query.pages[ Object.keys( data.query.pages )[ 0 ] ];
					if ( page.categories ) {

						for ( var i = 0; i < page.categories.length; i++ ) {
							var categoryTitle = page.categories[ i ].title;
							// the category title is of the form "Category:Foo" so must remove the "Category:" part
							categoryTitle = categoryTitle.replace( "Category:", "" );
							originNode.categories.push( categoryTitle );
						}
					}
				}

				self.callHooks( "AfterVisitNodeHook", [ originNode ] );
			}
		};

		/**
		 * Display categories for the given node modally.
		 *
		 * This method doubles as the UI for hiding nodes by category. It is called internally
		 * when the user chooses to either display categories for a node, or to hide nodes by
		 * a category.
		 *
		 * @param {Array} categories List of categories to display.
		 * @param {boolean} hideByCategory Whether to display checkboxes to allow nodes to be hidden.
		 */
		my.VikiJS.prototype.showCategories = function( categories, hideByCategory ) {
			var self = this;
			var categoriesHTML;
			if ( hideByCategory ) { // Hide By Category
				categoriesHTML = "\
				<div id='categoryDiv'>\
					<fieldset>\
						<legend>Categories</legend>\
						<table id='categoryContainer'>\
							<tbody>\
					";

				for ( var i = 0; i < categories.length; i++ ) {
					categoriesHTML += "<tr><td><input type='checkbox' class='categoryCheckbox' id='" + categories[ i ] + "' name='" + categories[ i ] + "' value=false><label for='" + categories[ i ] + "'>" + categories[ i ] + "</label></td></tr>";
				}

				categoriesHTML += "</tbody></table></fieldset></div>";

				vex.dialog.open( {
					message: "Select categories to hide:",
					input: categoriesHTML,
					contentCSS: {
						"min-width": '250px',
						"width": "auto",
						"display": "table"
					},
					afterOpen: function() {
						self.Force.stop();
						$( ".categoryCheckbox" )
							.each( function() {
								var checkbox = $( this );
								checkbox.click( function() {
									var value = checkbox.prop( 'checked' );
									checkbox.prop( 'value', value );
								} );
							} );
					},
					callback: function( data ) {
						if ( data ) {
							self.hideByCategories( Object.keys( data ) );
						}
					},
					showCloseButton: true
				} );

			} else { // Show Categories
				categoriesHTML = "\
				<div id='categoryDiv'>\
					<fieldset>\
						<legend>Categories</legend>\
						<ul id='categoryContainer'>\
					";

				if ( categories.length === 0 )
					categories.push( "No categories" );

				for ( var j = 0; j < categories.length; j++ ) {
					categoriesHTML += "<li>" + categories[ j ] + "</li>";
				}

				categoriesHTML += "</ul>";

				vex.open( {
					content: categoriesHTML,
					contentCSS: {
						"min-width": '150px',
						"width": "auto",
						"display": "table"
					},
					afterOpen: function() {
						self.Force.stop();
					}
				} );
			}
		};

		/*
		 * Node Management Methods
		 */

		/**
		 * Creates a new external page node to be added to the graph.
		 *
		 * This method is called internally when new external page information is returned.
		 *
		 * @param {string} url URL of the external page to be added to the graph.
		 *
		 * @return {Object} newly created node
		 */
		my.VikiJS.prototype.createExternalNode = function( url ) {
			var self = this;

			var node = self.newNode();
			var shortURL = url.replace( "http://", "" )
				.replace( "https://", "" )
				.replace( "www.", "" );
			node.displayName = ( shortURL.length < 20 ? shortURL : shortURL.substring( 0, 20 ) + "..." );
			node.fullDisplayName = url;
			node.type = self.EXTERNAL_PAGE_TYPE;
			node.URL = url;
			node.externalNodeIconURL = self.ImagePath + "internet.png";

			return node;
		};

		/**
		 * Create a new wiki node to be added to the graph.
		 *
		 * This method is called internally when an internal link to a wiki page is discovered
		 * in the node elaboration process.
		 * It calls createWikiNode to complete the wiki node creation.
		 *
		 * @param {string} pageTitle title of the internal wiki page
		 * @param {string} wikiTitle title of the wiki this page belongs to
		 *
		 * @return {Object} newly created node
		 */
		my.VikiJS.prototype.createWikiNodeFromWiki = function( pageTitle, wikiTitle ) {
			var self = this;

			var index = self.searchableWikiIndexForName( wikiTitle );
			var wiki = self.allWikis[ index ];
			var url = wiki.contentURL.substring( 0, wiki.contentURL.indexOf( "$1" ) ) + ( pageTitle.split( " " )
				.join( "_" ) );
			return self.createWikiNode( pageTitle, url, wiki, index );
		};

		/**
		 * Create a new wiki node from an external URL to a wiki page.
		 *
		 * This method is called internally when an external link to a wiki page is discovered
		 * in the node elaboration process.
		 * It calls createWikiNode to complete the wiki node creation.
		 *
		 * @param {string} url external URL of the wiki page.
		 * @param {number} wikiIndex index of the wiki this page belongs to.
		 *
		 * @return {Object} newly created node
		 */
		my.VikiJS.prototype.createWikiNodeFromExternalLink = function( url, wikiIndex ) {
			var self = this;
			var strippedContentURL = self.allWikis[ wikiIndex ].contentURL.substring( 0, self.allWikis[ wikiIndex ].contentURL.indexOf( "$1" ) );
			var pageTitle = url.replace( strippedContentURL, "" )
				.split( "_" )
				.join( " " );
			var wiki = self.allWikis[ wikiIndex ];

			return self.createWikiNode( pageTitle, url, wiki, wikiIndex );
		};

		/**
		 * Create a new wiki node to add to the graph.
		 *
		 * This method is called internally from createWikiNodeFromWiki or createWikiNodeFromExternalLink
		 * to complete the wiki node creation.
		 *
		 * @param {string} pageTitle title of the wiki page
		 * @param {string} url URL of the wiki page
		 * @param {Object} wiki Object representing the wiki this page belongs to
		 * @param {number} index index of this.allWikis that this wiki corresponds to
		 *
		 * @return {Object} newly created node
		 */

		my.VikiJS.prototype.createWikiNode = function( pageTitle, url, wiki, index ) {
			var node = self.newNode();
			node.pageTitle = pageTitle;
			node.displayName = pageTitle.length < 50 ? pageTitle : pageTitle.substring( 0, 50 ) + "...";
			node.fullDisplayName = pageTitle;
			node.type = self.WIKI_PAGE_TYPE;
			node.URL = url;
			node.wikiIndex = index;
			node.apiURL = wiki.apiURL;
			node.contentURL = wiki.contentURL;
			node.logoURL = wiki.logoURL;
			node.searchable = wiki.searchableWiki;
			node.sameServer = node.contentURL.indexOf( self.serverURL ) > -1; // if the node's content URL contains my server, it should have the same server
			node.wikiTitle = wiki.wikiTitle;

			return node;
		};

		/**
		 * Create a new node.
		 *
		 * @return {Object} newly created node
		 */

		my.VikiJS.prototype.newNode = function() {

			var node = {
				elaborated: false,
				fixed: false,
				hidden: false
			};
			return node;
		};

		/**
		 * Find this node in the active VIKI graph, if it exists.
		 *
		 * @param {string} property property type to search for
		 * @param {string} value value of the property to search for
		 *
		 * @return {Object} node, if it exists, else null
		 */

		my.VikiJS.prototype.findNode = function( property, value ) {
			var self = this;
			var oldString, newString, newValue;

			for ( var i = 0; i < self.Nodes.length; i++ ) {
				if ( property === 'pageTitle' ) {
					// a specific check for page titles - the first letter is case insensitive
					oldString = self.Nodes[ i ][ property ];
					if ( oldString ) {
						newString = self.replaceAt( oldString, oldString.indexOf( ":" ) + 1,
							oldString.charAt( oldString.indexOf( ":" ) + 1 )
							.toLowerCase() );
						newValue = self.replaceAt( value, value.indexOf( ":" ) + 1,
							value.charAt( value.indexOf( ":" ) + 1 )
							.toLowerCase() );
						if ( newString === newValue )
							return self.Nodes[ i ];
					}
				} else if ( typeof self.Nodes[ i ][ property ] !== 'undefined' && self.Nodes[ i ][ property ] === value ) {
					return self.Nodes[ i ];
				}
			}

			for ( i = 0; i < self.HiddenNodes.length; i++ ) {
				if ( property === 'pageTitle' ) {
					// a specific check for page titles - the first letter is case insensitive
					oldString = self.HiddenNodes[ i ][ property ];
					if ( oldString ) {
						newString = self.replaceAt( oldString, oldString.indexOf( ":" ) + 1, oldString.charAt( oldString.indexOf( ":" ) + 1 )
							.toLowerCase() );
						newValue = self.replaceAt( value, value.indexOf( ":" ) + 1, value.charAt( value.indexOf( ":" ) + 1 )
							.toLowerCase() );
						if ( newString === newValue )
							return self.HiddenNodes[ i ];
					}
				} else if ( typeof self.HiddenNodes[ i ][ property ] !== 'undefined' && self.HiddenNodes[ i ][ property ] === value ) {
					return self.HiddenNodes[ i ];
				}
			}
			return null;
		};

		/**
		 * Add a new node to the graph.
		 *
		 * This method is called internally when a newly created node is to be added to the VIKI graph.
		 *
		 * @param {Object} node to be added to the graph.
		 */
		my.VikiJS.prototype.addNode = function( node ) {
			var self = this;
			node.identifier = self.CURRENT_IDENTIFIER;
			self.CURRENT_IDENTIFIER++;
			self.Nodes.push( node );
			if ( self.Nodes.length === 1 ) {
				self.SelectedNodeIndex = 0;
			}

			if ( node.type === self.WIKI_PAGE_TYPE )
				self.callHooks( "NewWikiNodeAddedHook", [ node ] );
			else
				self.callHooks( "NewExternalNodeAddedHook", [ node ] );
		};

		/**
		 * Add a new link to the graph.
		 *
		 * This helper method is called internally when a new node has been added to the graph,
		 * and it must be linked to other nodes.
		 *
		 * @param {Object} node1 first node in the link
		 * @param {Object} node2 second node in the link
		 */
		my.VikiJS.prototype.addLink = function( node1, node2 ) {
			var self = this;

			var link = {
				source: node1,
				target: node2,
				bidirectional: false
			};
			self.Links.push( link );
			self.LinkMap[ node1.identifier + "," + node2.identifier ] = link;
			self.LinkMap[ node2.identifier + "," + node1.identifier ] = link;
			return link;
		};

		/**
		 * Find link in the active VIKI graph, if it exists.
		 *
		 * @param {number} from identifier of the first node in the link
		 * @param {string} to identifier of the second node in the link
		 *
		 * @return {Object} link if it exists, else null
		 */
		my.VikiJS.prototype.findLink = function( from, to ) {
			var self = this;
			var link = self.LinkMap[ from + "," + to ];
			if ( typeof link === 'undefined' ) {
				return null;
			}
			return link;
		};

		/*
		 * Graph Modification Methods
		 */

		/**
		 * Create a new wiki node from an external URL to a wiki page.
		 *
		 * This method is called internally when an external link to a wiki page is discovered
		 * in the node elaboration process.
		 * It calls createWikiNode to complete the wiki node creation.
		 *
		 * @param {string} url external URL of the wiki page.
		 * @param {number} wikiIndex index of the wiki this page belongs to.
		 */
		my.VikiJS.prototype.elaborateNodeAtIndex = function( index ) {
			var self = this;
			var node = self.Nodes[ index ];
			if ( node.type === self.WIKI_PAGE_TYPE )
				self.elaborateWikiNode( node );
		};

		/**
		 * Elaborate this wiki node.
		 *
		 * Node elaboration involves making MediaWiki API queries to find all
		 * external links out of this page, as well as all intra-wiki links
		 * into and out of this page. Each found node is then added to the graph. This method
		 * is called internally whenever the user chooses to elaborate a node.
		 *
		 * @param {Object} node node to elaborate
		 */
		my.VikiJS.prototype.elaborateWikiNode = function( node ) {
			var self = this;

			// 1. Get external links OUT from page.

			jQuery.ajax( {
				url: node.apiURL,
				dataType: node.sameServer ? 'json' : 'jsonp',
				data: {
					action: 'query',
					prop: 'extlinks',
					titles: node.pageTitle,
					ellimit: 'max',
					format: 'json',
					redirects: 'true'
				},
				success: function( data, textStatus, jqXHR ) {
					externalLinksSuccessHandler( data, textStatus, jqXHR, node );
				},
				error: function() {
					self.showError( mw.message( 'vikijs-error-external-links', node.pageTitle )
						.text() );
				}
			} );

			// 2. Get intra-wiki links OUT from page.
			jQuery.ajax( {
				url: node.apiURL,
				dataType: node.sameServer ? 'json' : 'jsonp',
				data: {
					action: 'query',
					prop: 'links',
					titles: node.pageTitle,
					pllimit: 'max',
					format: 'json',
					redirects: 'true'
				},
				success: function( data, textStatus, jqXHR ) {
					intraWikiOutSuccessHandler( data, textStatus, jqXHR, node );
				},
				error: function() {
					self.showError( mw.message( 'vikijs-error-intrawiki-out', node.pageTitle )
						.text() );
				}
			} );
			// 3. Get intra-wiki links IN to this page.
			jQuery.ajax( {
				url: node.apiURL,
				dataType: node.sameServer ? 'json' : 'jsonp',
				data: {
					action: 'query',
					list: 'backlinks',
					bltitle: node.pageTitle,
					bllimit: 'max',
					format: 'json',
					redirects: 'true'
				},
				success: function( data, textStatus, jqXHR ) {
					intraWikiInSuccessHandler( data, textStatus, jqXHR, node );
				},
				error: function() {
					self.showError( mw.message( 'vikijs-error-intrawiki-in', node.pageTitle )
						.text() );
				}
			} );
			node.elaborated = true;
			self.displayNodeInfo( node );

			function externalLinksSuccessHandler( data, textStatus, jqXHR, originNode ) {

				if ( data.error ) {
					self.showError( mw.message( 'vikijs-error-external-links', node.pageTitle )
						.text() );
					return;
				}

				var externalLinks = data.query.pages[ Object.keys( data.query.pages )[ 0 ] ].extlinks;
				if ( externalLinks ) {
					var newExternalNodes = [];
					// some of these external links are actually links to other searchable wikis.
					// these should be recognized as wiki nodes, not just external nodes.

					for ( var i = 0; i < externalLinks.length; i++ ) {
						var thisURL = externalLinks[ i ][ "*" ];

						// index of the searchable wiki in list of searchable wikis, or -1 if this is not a searchable wiki page.
						var index = self.indexOfWikiForURL( externalLinks[ i ][ "*" ] );
						// handle the case where the URL has the form "index.php?title=..." rather than "index.php/..."
						var alternativeTitleFormatIndex = self.indexOfWikiForURL( thisURL.replace( "?title=", "/" ) );

						var isWikiPage = ( index !== -1 || alternativeTitleFormatIndex !== -1 );
						var link;
						var externalNode;
						if ( isWikiPage ) {
							// if "index.php?title=..." form was used, swap it with "index.php/..." form.
							if ( alternativeTitleFormatIndex !== -1 ) {
								thisURL = thisURL.replace( "?title=", "/" );
								index = alternativeTitleFormatIndex;
							}

							externalNode = null;
							var externalWikiNode = self.findNode( "URL", thisURL );
							if ( !externalWikiNode ) {
								externalWikiNode = self.createWikiNodeFromExternalLink( thisURL, index );
								self.callHooks( "NewWikiNodeCreatedHook", [ externalWikiNode, originNode ] );
								if ( externalWikiNode.unadded )
									continue;
								else
									self.addNode( externalWikiNode );
							}
							if ( externalWikiNode.hidden ) {
								self.unhideNode( externalWikiNode.identifier );
							}
							link = self.findLink( originNode.identifier, externalWikiNode.identifier );
							if ( !link )
								link = self.addLink( originNode, externalWikiNode );
							else {
								link.bidirectional = true;
							}

							self.visitNode( externalWikiNode );
						} else {
							externalNode = self.findNode( "URL", thisURL );
							if ( !externalNode ) {
								externalNode = self.createExternalNode( thisURL );
								self.callHooks( "NewExternalNodeCreatedHook", [ externalNode, originNode ] );
								if ( externalNode.unadded )
									continue;
								else
									self.addNode( externalNode );
							}
							if ( externalNode.hidden ) {
								self.unhideNode( externalNode.identifier );
							}
							link = self.findLink( originNode.identifier, externalNode.identifier );
							if ( !link )
								link = self.addLink( originNode, externalNode );
							else {
								link.bidirectional = true;
							}
						}
						if ( externalNode )
							newExternalNodes.push( externalNode );
					}
					// now call hooks on these nodes to see if any other special way to handle it (e.g. MII Phonebook)
					self.callHooks( "ExternalNodeHook", [ newExternalNodes ] );
				}
				self.redraw( true );
			}

			function intraWikiOutSuccessHandler( data, textStatus, jqXHR, originNode ) {

				if ( data.error ) {
					self.showError( mw.message( 'vikijs-error-intrawiki-out', node.pageTitle )
						.text() );
					return;
				}
				var intraLinks = data.query.pages[ Object.keys( data.query.pages )[ 0 ] ].links;
				if ( intraLinks ) {
					// get list of namespaces, or fetch with AJAX if required.

					var wiki = self.allWikis[ originNode.wikiIndex ];

					var contentNamespaces = wiki.contentNamespaces;
					var intraNode;
					var newIntraOutNodes = [];
					for ( var i = 0; i < intraLinks.length; i++ ) {
						intraNode = self.findNode( "pageTitle", intraLinks[ i ].title );
						if ( !intraNode || ( intraNode.apiURL !== originNode.apiURL ) ) {
							// add the node to the graph immediately if it is within the wiki's content namespaces.

							if ( contentNamespaces.indexOf( intraLinks[ i ].ns ) > -1 ) {
								intraNode = self.createWikiNodeFromWiki( intraLinks[ i ].title, originNode.wikiTitle );
								self.callHooks( "NewWikiNodeCreatedHook", [ intraNode, originNode ] );
								if ( intraNode.unadded )
									continue;
								else
									self.addNode( intraNode );
							} else
								continue;

						}
						if ( intraNode ) {
							if ( intraNode.hidden )
								self.unhideNode( intraNode.identifier );
							var link = self.findLink( originNode.identifier, intraNode.identifier );
							if ( !link ) {
								link = self.addLink( originNode, intraNode );
							} else {
								// if the found link has this originNode as the SOURCE, this is an already known link OUT; disregard.
								// if the found link has this originNode as the TARGET, this is a NEW link out; set as bidirectional.
								if ( !link.bidirectional && link.target.identifier === originNode.identifier )
									link.bidirectional = true;
							}
							// now visit the wiki page to get more info (does it exist? what categories?)
							self.visitNode( intraNode );
						}
						newIntraOutNodes.push( intraNode );
					}
					// now call hooks on these nodes
					self.callHooks( "IntraOutNodeHook", [ newIntraOutNodes ] );
				}
				self.redraw( true );
			}

			function intraWikiInSuccessHandler( data, textStatus, jqXHR, originNode ) {

				if ( data.error ) {
					self.showError( mw.message( 'vikijs-error-intrawiki-in', node.pageTitle )
						.text() );
					return;
				}

				var intraLinks = data.query.backlinks;
				if ( intraLinks ) {
					// get list of namespaces, or fetch with AJAX if required.

					var wiki = self.allWikis[ originNode.wikiIndex ];
					var contentNamespaces = wiki.contentNamespaces;
					var intraNode;
					var newIntraInNodes = [];
					for ( var i = 0; i < intraLinks.length; i++ ) {
						intraNode = self.findNode( "pageTitle", intraLinks[ i ].title );
						if ( !intraNode || ( intraNode.apiURL !== originNode.apiURL ) ) {
							// add the node to the graph immediately if it is within the wiki's content namespaces.

							if ( contentNamespaces.indexOf( intraLinks[ i ].ns ) > -1 ) {
								intraNode = self.createWikiNodeFromWiki( intraLinks[ i ].title, originNode.wikiTitle );
								self.callHooks( "NewWikiNodeCreatedHook", [ intraNode, originNode ] );
								if ( intraNode.unadded )
									continue;
								else
									self.addNode( intraNode );
							} else
								continue;

						}
						if ( intraNode ) {
							if ( intraNode.hidden )
								self.unhideNode( intraNode.identifier );
							var link = self.findLink( intraNode.identifier, originNode.identifier );
							if ( !link )
								link = self.addLink( intraNode, originNode ); // opposite order because these are pages coming IN
							else {
								// if the found link has this originNode as the TARGET, this is an already known link IN; disregard.
								// if the found link has this originNode as the SOURCE, this is a NEW link in; set as bidirectional.
								if ( !link.bidirectional && link.source.identifier === originNode.identifier )
									link.bidirectional = true;
							}
							self.visitNode( intraNode );
						}

						newIntraInNodes.push( intraNode );
					}
					// now call hooks on these nodes
					self.callHooks( "IntraInNodeHook", [ newIntraInNodes ] );

				}
				self.redraw( true );
			}
		};

		/**
		 * Hide this node and all associated links from the graph.
		 *
		 * @param {Object} node node to hide from the graph
		 */
		my.VikiJS.prototype.hideNode = function( node ) {
			var recentHiddenLinks = Array();

			// 1. Remove node from Nodes array and store into hidden nodes array.
			node.hidden = true;
			self.HiddenNodes.push( node );
			self.Nodes.splice( node.index, 1 );
			for ( var i = node.index; i < self.Nodes.length; i++ )
				self.Nodes[ i ].index--;

			// 2. Remove any associated links from Links array and store into hidden links array.
			// Also store into recentHiddenLinks so we can remove them from LinkMap.
			for ( var j = self.Links.length - 1; j >= 0; j-- ) {
				var link = self.Links[ j ];
				if ( link.source === node || link.target === node ) {
					self.HiddenLinks.push( link );
					recentHiddenLinks.push( link );
					self.Links.splice( j, 1 );
				}
			}

			// 3. Remove links from LinkMap.
			for ( var k = 0; k < recentHiddenLinks.length; k++ ) {
				var key = recentHiddenLinks[ k ].source.identifier + "," + recentHiddenLinks[ k ].target.identifier;
				var reverse = recentHiddenLinks[ k ].target.identifier + "," + recentHiddenLinks[ k ].source.identifier;
				if ( self.LinkMap[ key ] )
					delete self.LinkMap[ key ];
				if ( self.LinkMap[ reverse ] )
					delete self.LinkMap[ reverse ];
			}

			// 4. Set selected node to none and display "No Node Selected" since the old selected node is now hidden.
			self.SelectedNodeIndex = -1;
			self.displayNoNodeSelected();

		};

		/**
		 * Hide this node and redraw the graph.
		 * This is a convenience method called internally to hide a node in the graph and then redraw the graph.
		 *
		 * @param {Object} node node to hide from the graph
		 */
		my.VikiJS.prototype.hideNodeAndRedraw = function( node ) {
			self.hideNode( node );
			self.redraw( true );
		};

		/**
		 * Hide this hub from the graph.
		 *
		 * This method is called when the user elects to hide an elaborated node from the graph,
		 * along with all leaf nodes attached to it (i.e. nodes not attached to other nodes).
		 *
		 * @param {Object} node central node of the hub to be hidden
		 */
		my.VikiJS.prototype.hideHub = function( node ) {
			if ( !node.elaborated )
				return;

			self.hideCluster( node, self.HIDE_HUB );
		};

		/**
		 * Hide this cluster from the graph.
		 *
		 * This is the generic method called internally by hideHub, hideIncomingLinks and hideOutgoingLinks.
		 *
		 * @param {Object} node central node of the node collection to be hidden
		 * @param {number} hideType type of collection to be hidden:
		 * - hub
		 * - incoming links
		 * - outgoing links
		 */
		my.VikiJS.prototype.hideCluster = function( node, hideType ) {
			// hideCluster is the same call for hideHub, hideIncomingLinks and hideOutgoingLinks.
			// We iterate links to check all nodes participating in those links which are connected to the passed-in node.
			// If hideHub was the caller, identify all nodes connected to this node which aren't connected to any others (i.e. leaf nodes).
			// If hideIncomingLinks or hideOutgoingLInks was the caller, just identify all connected nodes.

			var i;

			var nodesToRemove = [];
			if ( hideType === self.HIDE_HUB )
				nodesToRemove.push( node );

			for ( i = 0; i < self.Links.length; i++ ) {
				var link = self.Links[ i ];

				// hideHub doesn't care about bidirectionality of links, but hideIncomingLinks and hideOutgoingLinks do.
				if ( link.bidirectional && ( link.source === node || link.target === node ) && hideType !== self.HIDE_HUB ) {
					var thisNode = link.source === node ? link.target : link.source;
					// Only want to hide bidirectional links if BOTH hideIncoming and hideOutgoing will be the case for the passed-in node.
					// Thus, if hideType is HIDE_INCOMING and the node is already hidingOutgoing, hide this bidirectional link.
					// Same if hideType is HIDE_OUTGOING and the node is already hidingIncoming.
					if ( ( hideType === self.HIDE_INCOMING && node.hidingOutgoing ) || ( hideType === self.HIDE_OUTGOING && node.hidingIncoming ) ) {
						nodesToRemove.push( thisNode );
					}
				} else if ( link.source === node ) {
					if ( hideType === self.HIDE_OUTGOING || ( hideType === self.HIDE_HUB && self.numberOfConnections( link.target ) === 1 ) )
						nodesToRemove.push( link.target );
				} else if ( link.target === node ) {
					if ( hideType === self.HIDE_INCOMING || ( hideType === self.HIDE_HUB && self.numberOfConnections( link.source ) === 1 ) )
						nodesToRemove.push( link.source );
				}
			}

			for ( i = 0; i < nodesToRemove.length; i++ ) {
				self.hideNode( nodesToRemove[ i ] );
			}

			if ( hideType === self.HIDE_INCOMING || hideType === self.HIDE_OUTGOING ) {
				self.SelectedNodeIndex = node.index;
				self.displayNodeInfo( self.Nodes[ self.SelectedNodeIndex ] );
			}

			self.redraw( true );
		};

		/**
		 * Hide incoming links to this node from the graph.
		 *
		 * This method is called the user elects to hide incoming links to a given node.
		 *
		 * @param {Object} node node whose incoming links are to be hidden.
		 */
		my.VikiJS.prototype.hideIncomingLinks = function( node ) {
			self.log( "hideIncomingLinks for " + node.pageTitle );
			self.hideCluster( node, self.HIDE_INCOMING );
			node.hidingIncoming = true;
		};

		/**
		 * Hide outgoing links from this node from the graph.
		 *
		 * This method is called the user elects to hide outgoing links from a given node.
		 *
		 * @param {Object} node node whose outgoing links are to be hidden.
		 */
		my.VikiJS.prototype.hideOutgoingLinks = function( node ) {
			self.log( "hideOutgoingLinks for " + node.pageTitle );
			self.hideCluster( node, self.HIDE_OUTGOING );
			node.hidingOutgoing = true;
		};

		/**
		 * Hide nodes in the graph by the categories their pages belong to.
		 *
		 * This method is called when the user elects to hide nodes based on categories.
		 *
		 * @param {Array} categories list of categories to hide nodes by
		 */
		my.VikiJS.prototype.hideByCategories = function( categories ) {
			var self = this;
			categories.forEach( function( category ) {
				var nodesInThisCategory = self.Nodes.filter( function( node ) {
					return node.categories ? node.categories.indexOf( category ) !== -1 : false;
				} );

				nodesInThisCategory.forEach( function( node ) {
					self.hideNode( node );
				} );
			} );

			self.redraw( true );
		};

		/**
		 * Unhide node from the graph.
		 *
		 * This method is called internally when the user elects to show all nodes.
		 *
		 * @param {number} identifier identifier for the node to be unhidden
		 */
		my.VikiJS.prototype.unhideNode = function( identifier ) {
			var index = -1;
			for ( var i = 0; i < self.HiddenNodes.length; i++ ) {
				if ( self.HiddenNodes[ i ].identifier === identifier ) {
					index = i;
					break;
				}
			}

			if ( index === -1 )
				return;

			self.Nodes.push( self.HiddenNodes[ index ] );
			self.HiddenNodes.splice( index, 1 );

			self.redraw( true );

		};

		/**
		 * Show all nodes in the graph, re-adding any hidden nodes.
		 *
		 * This method is called the user elects to show all nodes in the graph.
		 *
		 */
		my.VikiJS.prototype.showAllNodes = function() {
			// 1. Add all hidden nodes back into main Nodes array, then destroy hidden nodes array.
			var i;

			for ( i = 0; i < self.HiddenNodes.length; i++ ) {
				self.Nodes.push( self.HiddenNodes[ i ] );
				self.HiddenNodes[ i ].index = self.Nodes.length - 1;
				self.HiddenNodes[ i ].hidden = false;
			}
			self.HiddenNodes = [];

			// 2. Add all hidden links back into main Links array. Also add all hidden links back into the LinkMap.
			// Then destroy hidden links array.
			for ( i = 0; i < self.HiddenLinks.length; i++ ) {
				var link = self.HiddenLinks[ i ];
				self.Links.push( link );
				self.LinkMap[ link.source.identifier + "," + link.target.identifier ] = link;
				self.LinkMap[ link.target.identifier + "," + link.source.identifier ] = link;
			}

			self.HiddenLinks = [];

			self.Nodes.forEach( function( node ) {
				node.hidingIncoming = false;
				node.hidingOutgoing = false;
			} );

			self.redraw( true );

		};

		/*
		 * Helper Methods
		 */

		/**
		 * Get the index of a wiki from URL to a page in that wiki.
		 *
		 * This helper method is called internally.
		 *
		 * @param {string} url URL of the page whose wiki is to be determined.
		 *
		 * @return {number} index of the wiki, or -1 if it was not found.
		 */
		my.VikiJS.prototype.indexOfWikiForURL = function( url ) {
			var self = this;
			for ( var i = 0; i < self.allWikis.length; i++ ) {
				var strippedContentURL = self.allWikis[ i ].contentURL.substring( 0, self.allWikis[ i ].contentURL.indexOf( "$1" ) );
				if ( url.indexOf( strippedContentURL ) !== -1 )
					return i;
			}
			return -1;
		};

		/*
		 * Get the index of a wiki from the wiki name.
		 *
		 * This helper method is called internally.
		 *
		 * @param {string} wikiTitle name of the wiki
		 *
		 * @return {number} index of the wiki, or -1 if it was not found.
		 */
		my.VikiJS.prototype.searchableWikiIndexForName = function( wikiTitle ) {
			var self = this;

			for ( var i = 0; i < self.allWikis.length; i++ )
				if ( self.allWikis[ i ].wikiTitle === wikiTitle )
					return i;

			return -1;
		};

		/*
		 * Replace the character at index of a string with the new specified sequence.
		 *
		 * This helper method is called internally.
		 *
		 * @param {string} string string to be modified
		 * @param {number} index index of the character to be replaced
		 * @param {string} character new character to be inserted
		 *
		 * @return {string} newly modified string
		 */
		my.VikiJS.prototype.replaceAt = function( string, index, character ) {
			return string.substr( 0, index ) + character + string.substr( index + character.length );
		};

		/*
		 * Get the number of nodes connected to this node.
		 *
		 * This helper method is called internally to help determine whether nodes are leaf nodes.
		 *
		 * @param {Object} node node to be examined
		 *
		 * @return {number} number of connections to this node
		 */
		my.VikiJS.prototype.numberOfConnections = function( node ) {
			var connections = self.Links.filter( function( link ) {
				return link.source.identifier === node.identifier || link.target.identifier === node.identifier;
			} );

			return connections.length;
		};

		/*
		 * Log statement to the console.
		 *
		 * This helper method is called internally as a replacement for console.log, because
		 * Internet Explorer doesn't define console.log unless the console is active.
		 *
		 * @param {string} text text to be logged
		 */
		my.VikiJS.prototype.log = function( text ) {
			if ( ( window.console !== undefined ) )
				window.console.log( text );
		};

		/*
		 * Display this error message in the error div.
		 *
		 * Call this helper method from VIKI plugins whenever an error has occurred which the user
		 * should know about. This method is also called internally by VIKI for errors. If no errors
		 * are being displayed, then the error div is hidden; once showError is called, the error
		 * div is displayed with any errors that have been called.
		 *
		 * @param {string} errorText text of the error to be displayed
		 */
		my.VikiJS.prototype.showError = function( errorText ) {
			$( "#" + self.ErrorsDiv )
				.css( "visibility", "visible" );
			$( "#" + self.ErrorsDiv )
				.append( "<p>" + errorText + "</p>" );
		};

		/*
		 * VikiJS Hook Structure Methods
		 */

		/*
		 * Call hooks for the given hook name.
		 *
		 * This method is central to the VIKI hook structure. Any plugins which have registered function hooks
		 * with defined hook points will have the function hooks called through this function at the time
		 * of the hook event. This method should not be called externally by VIKI plugins; instead, register
		 * hook functions with $wgVIKI_Function_Hooks in the plugin's PHP file. See VIKI extension documentation
		 * for more details.
		 *
		 * @param {string} hookName name of the hook event
		 * @return {parameters} parameters that are to be passed to the hook functions. These are well defined
		 * based on the hook name. See VIKI extension documentation for more details.
		 */
		my.VikiJS.prototype.callHooks = function( hookName, parameters ) {
			var self = this;
			if ( this.hasHooks ) {
				if ( this.Hooks[ hookName ] ) {
					for ( var i = 0; i < self.Hooks[ hookName ].length; i++ ) {
						// Determine appropriate scope and call function.
						// http://stackoverflow.com/questions/912596/how-to-turn-a-string-into-a-javascript-function-call

						var hookFunction = self.Hooks[ hookName ][ i ];

						var scope = window;
						var scopeSplit = hookFunction.split( '.' );
						for ( var j = 0; j < scopeSplit.length - 1; j++ ) {
							scope = scope[ scopeSplit[ j ] ];

							if ( scope === undefined ) return false;
						}

						scope[ scopeSplit[ scopeSplit.length - 1 ] ]( self, parameters, hookName );
					}

					return true;
				}
			}
			return false;
		};

		/*
		 * Completion handler for a hook function call.
		 *
		 * Call this method at the completion of your hook function for a VIKI plugin to let VIKI know
		 * that a hook function has completed executing. Include in the method call parameters specifying
		 * whether VIKI should redraw the entire graph in response to your hook function, or just redraw a
		 * single node; if the latter, also specify the node to be redrawn. As of VIKI 1.0, this method
		 * only serves to ensure content namespaces are fetched at the end of GetAllWikisHook and to allow
		 * VIKI to redraw the graph or a node; in the future, other functions may be added to this method.
		 *
		 * @param {string} hookName name of the hook event
		 * @param {Array} parameters parameters to be passed to VIKI, such as whether the graph should be
		 * redrawn or a single node should be redrawn
		 */
		my.VikiJS.prototype.hookCompletion = function( hookName, parameters ) {
			var self = this;
			// let VikiJS know that the hook was completed, so VikiJS can perform actions if needed.

			parameters = parameters || {};
			if ( hookName === "GetAllWikisHook" ) {
				self.fetchContentNamespaces();
			}
			if ( parameters.redraw && parameters.redraw === true )
				self.redraw( true );

			if ( parameters.redrawNode && parameters.redrawNode === true && parameters.node ) {
				self.redrawNode( parameters.node );
				self.displayNodeInfo( self.Nodes[ self.SelectedNodeIndex ] );
			}
		};
	};

	return my;
}( mediaWiki, jQuery, vex, Spinner, d3, window.VIKI || {} ) );
