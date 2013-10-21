#!/usr/bin/env node
var argv = require('optimist').argv;
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var concat = require('concat-stream');

if (argv._[0] === 'start') {
    var args = [ '-l', '^(wpa_supplicant|dhclient)' ];
    exec('pgrep ' + args.join(' '), function (err, stdout) {
        if (stdout.length > 2) {
            console.error(
                'WARNING: these processes are already already running:\n'
                + stdout.split('\n')
                    .map(function (line) { return '  ' + line })
                    .join('\n')
                + '\nProbably nothing will work while those processes are'
                + ' running.'
            );
        }
        var args = [ '-i', 'wlan2', '-c', '/etc/wpa_supplicant.conf' ];
        spawn('wpa_supplicant', args, { stdio: 'inherit' });
        exec('dhclient', [ 'wlan2', '-r' ], function () {
            spawn('dhclient', [ 'wlan2', '-d' ], { stdio: 'inherit' });
        });
    });
    return;
}
if (argv._[0] === 'add') {
    if (argv._.length < 3) {
        console.error('usage: wit add SSID PASSPHRASE');
        return process.exit(1);
    }
    spawn('wpa_passphrase', argv._[1], argv._[2])
        .pipe(concat(function (body) {
            
        }))
    ;
    return;
}

var table = require('text-table');
var fs = require('fs');
var known = fs.readFileSync('/etc/wpa_supplicant.conf', 'utf8')
    .split('\n').reduce(function (acc, line) {
        var m;
        if (m = /^\s*ssid="([^"]*)"/.exec(line)) {
            acc.current = m[1]
        }
        if (m = /^\s*psk=(\S+)/.exec(line)) {
            acc.networks[acc.current] = true;
        }
        return acc;
    }, { current: {}, networks: {} }).networks
;

var iwscan = require('../lib/scan.js');
iwscan(function (err, signals) {
    if (err) return console.error(err);
    
    var rows = Object.keys(signals).sort(cmp).map(map);
    
    function map (key) {
        var sig = signals[key];
        
        var enc = (function () {
            if (sig.wpa || sig.rsn) return 'WPA';
            if (!sig['ht operation']) {
                return 'FREE';
            }
            return '???';
        })();
        
        if (enc !== 'FREE' && known[sig.ssid]) enc += '*';
        
        var ssid = sig.ssid;
        if (ssid.length > 30) ssid = ssid.slice(0, 30 - 3) + '...';
        return [ ssid, sig.signal, enc ];
    }
    console.log(table(rows));
    
    function cmp (a, b) {
        return a.ssid < b.ssid ? -1 : 1;
    }
});