<?php
// PHP's built-in server in front of the test WordPress: real files as they are, everything else to index.php
// (so /ads.txt reaches WordPress when there is no file, as on Apache or nginx with the usual rules).
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$file = $_SERVER['DOCUMENT_ROOT'] . $path;
if ($path !== '/' && is_file($file)) return false;
if (is_dir($file) && is_file(rtrim($file, '/') . '/index.php')) { require rtrim($file, '/') . '/index.php'; return true; }
$_SERVER['SCRIPT_NAME'] = '/index.php';
require $_SERVER['DOCUMENT_ROOT'] . '/index.php';
