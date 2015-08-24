<?php
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

/**
* To activate the functionality of this extension include the following
* in your LocalSettings.php file:
* $wgRegisterInternalExternals = true;
* include_once("$IP/extensions/VIKI/VIKI.php");
*
* If $wgRegisterInternalExternals was not already true, you must run
* refreshLinks.php after setting this flag.
*/

class VikiJS {

	private static $pqnum = 0;
	private static $modules = array( "ext.VIKI", "jquery.ui.slider", "jquery.ui.progressbar" );
	private static $functionHooks = array();
	private static $functionHookParams = array();

	/**
	 * Adds a VIKI plugin ResourceLoader resource module to be loaded.
	 *
	 * @param string $moduleName the name of the resource module to be loaded,
	 * e.g. "ext.VikiSemanticTitle"
	 */

	static function addResourceModule( $moduleName ) {
		self::$modules[] = $moduleName;
	}

	/**
	 * Adds a PHP hook to be called by VIKI.
	 *
	 * @param string $functionName name of PHP function to be called
	 * @param array $params parameters to the function to be called
	 *
	 */

	static function addPHPHook( $functionName, $params ) {
		self::$functionHooks[] = $functionName;
		self::$functionHookParams[] = $params;
	}

	/**
	 * Displays the VIKI graph.
	 *
	 * @param Parser $parser MediaWiki parser
	 * @param array $pageTitles array of page titles to display
	 * @param integer $width width of the graph
	 * @param integer $height height of the graph
	 */

	function display( $parser, $pageTitles, $width, $height ) {

		global $wgVIKI_Function_Hooks;
		global $wgVIKI_Hidden_Categories;
		global $wgServer;
		global $wgScriptPath;
		global $wgLogo;

		$div = "VIKI_" . self::$pqnum++;
		$graphdiv = $div . "_graph";
		$detailsdiv = $div . "_details";
		$subdetailsdiv = $div . "_details_data";
		$errorsdiv = $div . "_errors";
		$sliderdiv = $detailsdiv . "_zoom_slider";

		$output = <<<EOT
<div id="$div">
<table>
<tr><td><div class="vikijs-graph-container" id="$graphdiv">
</div></td></tr>
<tr><td><div class="vikijs-detail-panel" id="$detailsdiv">
<div class="vikijs-subdetail-panel" id="$subdetailsdiv"></div>
<div class="vikijs-zoom-slider" id="$sliderdiv"></div>
</div></td></tr>
<tr><td><div class="vikijs-errors-panel" id="$errorsdiv">
</div></td></tr>
</table>
</div>
EOT;

		$outputObject = $parser->getOutput();

		foreach ( self::$modules as $name ) {
			$outputObject->addModules( $name );
		}

		$index = 0;
		foreach ( self::$functionHooks as $hook ) {
			call_user_func_array( $hook, self::$functionHookParams[$index] );
			$index++;
		}

		$pageTitles_json = addslashes( json_encode( array_map( 'trim', $pageTitles ) ) );
		$modules_json = addslashes( json_encode( self::$modules ) );
		$divs_json = addslashes( json_encode( array( $graphdiv, $subdetailsdiv,
			$sliderdiv, $errorsdiv ) ) );
		$parameters_json = addslashes( json_encode( array(
															'width' => $width,
															'height' => $height,
															'imagePath' => $wgServer . $wgScriptPath .  '/extensions/VIKI/',
															'hooks' => $wgVIKI_Function_Hooks,
															'logoURL' => $wgLogo,
															'hiddenCategories' => $wgVIKI_Hidden_Categories ) ) );

		$script = <<<END
addEvent(window, 'load', function() {
	modules = jQuery.parseJSON("$modules_json");
	mw.loader.using(jQuery.parseJSON("$modules_json"), function () {
		$(document).ready(function() {
			var g = new VIKI.VikiJS();
			g.initialize("$pageTitles_json", "$divs_json", "$parameters_json");
		});
	});
});

function addEvent(element, event, fn) {
    if (element.addEventListener)
        element.addEventListener(event, fn, false);
    else if (element.attachEvent)
        element.attachEvent('on' + event, fn);
}
END;

		$script = '<script type="text/javascript">' . $script . '</script>';

		global $wgOut;
		$wgOut->addScript( $script );

		return $output;
	}
}
