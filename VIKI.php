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

define( 'VIKIJS_VERSION', '1.1' );

if ( !defined( 'MEDIAWIKI' ) ) {
	die( '<b>Error:</b> This file is part of a MediaWiki extension and cannot be run standalone.' );
}

if ( version_compare( $wgVersion, '1.22', 'lt' ) ) {
	die( '<b>Error:</b> This version of VIKI is only compatible with MediaWiki 1.22 or above.' );
}

if ( !defined( 'SMW_VERSION' ) ) {
	die( '<b>Error:</b> You need to have ' .
		'<a href="https://semantic-mediawiki.org/wiki/Semantic_MediaWiki">Semantic MediaWiki</a>' .
		' installed in order to use VIKI.' );
}

if ( version_compare( SMW_VERSION, '1.9', '<' ) ) {
	die( '<b>Error:</b> VIKI is only compatible with Semantic MediaWiki 1.9 or above.' );
}

$wgExtensionCredits['parserhook'][] = array (
	'name' => 'VIKI',
	'version' => VIKIJS_VERSION,
	'author' => array('[http://www.mediawiki.org/wiki/User:Jji Jason Ji]',
						'[http://www.mediawiki.org/wiki/User:Cindy.cicalese Cindy Cicalese]'),
	'descriptionmsg' => 'viki-desc',
	'path' => __FILE__,
	'url' => 'http://www.mediawiki.org/wiki/Extension:VIKI'
);

$wgExtensionMessagesFiles['VIKIMagic'] =
	__DIR__ . '/VIKI.i18n.magic.php';

$wgMessagesDirs['VIKI'] = __DIR__ . '/i18n';

$wgResourceModules['ext.VIKI'] = array(
	'localBasePath' => dirname( __FILE__ ),
	'remoteExtPath' => 'VIKI',
	'styles' => array(
		'VIKI.css',
		'vex.css',
		'vex-theme-default.css'
	),
	'scripts' => array(
		'd3.v3.js',
		'vex.combined.min.js',
		'spin.min.js',
		'contextmenu.js',
		'VIKI.js'
	),
	'dependencies' => array(
		'mediawiki.jqueryMsg',
	),
	'messages' => array(
	'viki-error-title',
	'viki-error-missing-pageTitle',
	'viki-timeout-content-namespace',
	'viki-error-content-namespace',
	'viki-error-visit-node',
	'viki-error-external-links',
	'viki-error-intrawiki-out',
	'viki-error-intrawiki-in'
	)
);

$wgHooks['ParserFirstCallInit'][] = 'efVIKIParserFunction_Setup';

$wgAPIModules['getContentNamespaces'] = 'ApiGetContentNamespaces';

$wgAutoloadClasses['VikiJS'] = __DIR__ . '/VikiJS.class.php';
$wgAutoloadClasses['ApiGetSiteLogo'] = __DIR__ . '/ApiGetSiteLogo.php';
$wgAutoloadClasses['ApiGetContentNamespaces'] = __DIR__ . '/ApiGetContentNamespaces.php';

function efVIKIParserFunction_Setup ( & $parser ) {
	$parser->setFunctionHook( 'viki', 'viki' );
	return true;
}

function viki( Parser $parser ) {
	$myparams = func_get_args();
	array_shift( $myparams );

	$paramDictionary = vikiJS_parseParameters( $myparams );

	$width = isset( $paramDictionary['width'] ) ? (int) $paramDictionary['width'] : 1200;
	$height = isset( $paramDictionary['height'] ) ? (int) $paramDictionary['height'] : 600;
	$delimiter = isset( $paramDictionary['delimiter'] ) ? $paramDictionary['delimiter'] : ',';
	$pageTitles = isset( $paramDictionary['pageTitles'] ) ? explode( $delimiter,
			$paramDictionary['pageTitles'] ) : array( $parser->getTitle()->getText() );

	$vikiJS = new VikiJS;
	$output = $vikiJS->display( $parser, $pageTitles, $width, $height );
	$parser->disableCache();
	return array( $parser->insertStripItem( $output, $parser->mStripState ),
		'noparse' => false );
}

function vikiJS_parseParameters( $params ) {
	$paramArray = array();
	foreach ( $params as $param ) {
		$ret = preg_split( '/=/', $param, 2 );
		if ( count( $ret ) > 1 ) {
			$paramArray[$ret[0]] = $ret[1];
		}
	}
	return $paramArray;
}
