module.exports = function ( gobblefile, getTask ) {
	var pathwatcher = require( 'pathwatcher' ),
		logger = require( './utils/logger' ),
		watchers = {},
		task,
		watcher,
		resuming;

	resume();

	watcher = pathwatcher.watch( gobblefile, onchange );

	function onchange( type, path ) {
		delete require.cache[ path ];
		logger.info({
			code: 'GOBBLEFILE_CHANGED'
		});
		restart();
	}

	function restart () {
		if ( resuming ) {
			return;
		}

		process.env.GOBBLE_RESET_UID = 'reset';

		if ( task ) {
			resuming = true;

			task.pause().then( function () {
				resuming = false;
				require.cache[ gobblefile ].children.forEach(function (c) {
					if ( watchers[c.id] ) return;
					watchers[c.id] = pathwatcher.watch( c.id, onchange );
				})

				delete require.cache[ gobblefile ];
				resume();
			});
		} else {
			resume();
		}
	}

	function resume () {
		var node, err;

		try {
			node = require( gobblefile );

			if ( !node._gobble ) {
				throw new Error( 'Did you forget to export something in your gobblefile?' );
			}

			if ( task ) {
				task.resume( node );
			} else {
				task = getTask( node );

				task.on( 'info',  logger.info );
				task.on( 'error', logger.error );
			}
		} catch ( e ) {
			if ( e.name !== 'GobbleError' ) {
				err = {
					name: 'GobbleError',
					code: 'STARTUP_ERROR',
					original: e
				};
			} else {
				err = e;
			}

			logger.error( err, restart );
		}
	}
};
