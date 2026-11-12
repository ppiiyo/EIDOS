<?php
declare(strict_types=1);

/**
 * Проверяет, что каждый класс, зарегистрированный в install/index.php
 * (CAgent / RegisterModuleDependences), резолвится через include.php.
 * Ловит класс ошибок "удалили class_alias — агент перестал работать".
 *
 * Bitrix-ядро не требуется: include.php грузится standalone
 * (обращения к Bitrix — внутри методов; class_exists('\CModule') = false).
 */
$base = dirname(__DIR__) . '/packages/connectors/bitrix';
$include = $base . '/include.php';
$installPath = $base . '/install/index.php';

if (!is_file($include)) {
    fwrite(STDERR, "Не найден include.php: {$include}\n");
    exit(1);
}
if (!is_file($installPath)) {
    fwrite(STDERR, "Не найден install/index.php: {$installPath}\n");
    exit(1);
}

require_once $include;

$install = (string) file_get_contents($installPath);
$names = [];

// CAgent::AddAgent('EidosConnector::syncDeltaAgent();')
preg_match_all("/'([A-Za-z_][A-Za-z0-9_]*)::/", $install, $m1);
$names = array_merge($names, $m1[1]);

// RegisterModuleDependences(..., 'EidosConnector', 'method')
preg_match_all('/RegisterModuleDependences\(([^;]*)\);/s', $install, $m2);
foreach ($m2[1] as $args) {
    if (preg_match_all("/'([A-Za-z_][A-Za-z0-9_]*)'/", $args, $mm)) {
        foreach ($mm[1] as $n) {
            if (preg_match('/^Eidos/', $n)) {
                $names[] = $n;
            }
        }
    }
}

$names = array_values(array_unique($names));
if (!$names) {
    fwrite(STDERR, "Не найдено ни одного класса в install/index.php — проверь регулярные выражения.\n");
    exit(1);
}

$fail = 0;
foreach ($names as $n) {
    if (class_exists($n)) {
        echo "OK   {$n}\n";
    } else {
        echo "FAIL {$n} — зарегистрирован в install/index.php, но не резолвится через include.php\n";
        $fail++;
    }
}

exit($fail ? 1 : 0);
