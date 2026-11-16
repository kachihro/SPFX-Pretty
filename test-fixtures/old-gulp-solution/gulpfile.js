'use strict';
const build = require('@microsoft/sp-build-web');
build.addSuppression(`Warning - [sass] The local CSS class 'ms-Grid' is not camelCase and will not be type-safe.`);
build.configureWebpack.mergeConfig({ additionalConfiguration: (cfg) => { cfg.resolve.alias = { '@src': 'src' }; return cfg; } });
build.initialize(require('gulp'));
