function parseImportPayload(input) {
    const wrapper = `
        ${input}
        return {
            tools: typeof tools !== 'undefined' ? tools : undefined,
            hiddenApps: typeof hiddenApps !== 'undefined' ? hiddenApps : undefined,
            hiddenApp: typeof hiddenApp !== 'undefined' ? hiddenApp : undefined
        };
    `;

    const importParser = new Function(wrapper);
    return importParser();
}

var input = "const tools = [\n    {\n        name: 'Utilidades',\n        icon: 'Toolbox',\n        folder: true,\n        apps: [\n            { name: 'Progreso', icon: 'Loader2', url: 'Apps/progreso.html' },\n            { name: 'Calculadora de dinero', icon: 'Coins', url: 'Apps/dinero.html' },\n            { name: 'Calculadora tiempo de descarga', icon: 'Download', url: 'Apps/calculadora-descarga.html' },\n            { name: 'Medidas', icon: 'Ruler', url: 'Apps/medidas.html' }\n        ]\n    },\n    {\n        name: 'Productividad',\n        icon: 'Focus',\n        folder: true,\n        apps: [\n            { name: 'Calendario [BETA]', icon: 'Calendar', url: 'Apps/calendario.html' }\n        ]\n    },\n    {\n        name: 'MC',\n        icon: 'Cuboid',\n        folder: true,\n        apps: [\n            { name: 'CraftPalette', icon: 'Command', url: 'Apps/craftpalette.html' },\n            { name: 'Mod compatibility checker', icon: 'ListCheck', url: 'Apps/modchecker.html' }\n        ]\n    },\n    {\n        name: 'Sistema',\n        icon: 'Settings2',\n        folder: true,\n        apps: [\n            { name: 'App maker', icon: 'ColumnsSettings', url: 'Apps/appmaker.html' },\n            { name: 'Galer?a de iconos', icon: 'LayoutList', url: 'Apps/icontest.html' }\n        ]\n    }\n];\n\nconst hiddenApp = { name: 'Neo GameCenter', icon: 'Gamepad2', url: 'games.html' };";

var result = parseImportPayload(input);
WScript.Echo('tools len=' + (result.tools ? result.tools.length : 'undefined'));
WScript.Echo('hiddenApps len=' + (result.hiddenApps ? result.hiddenApps.length : 'undefined'));
WScript.Echo('hiddenApp=' + (result.hiddenApp ? result.hiddenApp.name : 'undefined'));
