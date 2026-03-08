// reserve 10 % loading for bootstrapping
var INITIAL_LOAD_PERCENT = 10;

var fileLoadErrors = [];
var initialized = false;

function initCAGame() {
    var arrDomain = location.hostname.split('.');
    if (arrDomain.length > 2) {
        try {
            arrDomain.shift();
            document.domain = arrDomain.join('.');
        } catch (e) {
            console.warn("Domain shift failed, but carrying on...");
        }
    }

    window.preloader = {};
    var fileCounter = 0;
    var files = ['../shared/lib/phaser.min.js', 'js/main.js'];
    var retries = parent.window.gameBridge ? parent.window.gameBridge.info.numberOfRetries : 1;

    var loadNext = function(_retriesRemaining) {
        if(++fileCounter < files.length) {
            loadJS(files[fileCounter], loadNext, _retriesRemaining);
        }
    }
    loadJS(files[fileCounter], loadNext, retries);
}

function getTrimmedName(name, maxLength) {
    var nameEntry = name;
    if (nameEntry.length > maxLength) {
        nameEntry = nameEntry.substring(0, maxLength) + 'â€¦';
    }

    return nameEntry;
}

function loadJS(url, implementationCode, retriesRemaining){
    var scriptTag = document.createElement('script');
    var onError = function() {
        console.warn('retrying load', url);
        if (retriesRemaining) {
            loadJS(url, implementationCode, --retriesRemaining);
        } else {
            console.error('unable to load', url);
        }
    }
    scriptTag.src = url;
    scriptTag.onerror = onError;
    scriptTag.onload = implementationCode;
    if (implementationCode) {
        scriptTag.onreadystatechange = implementationCode.bind(this, retriesRemaining);
    }

    document.getElementsByTagName('head')[0].appendChild(scriptTag);
};

function findScoreIndex(score, leaderboardText, scoreAttribute, studentId) {
    var scoreIndex = -1;
    var i;
    if (leaderboardText != null && leaderboardText[scoreAttribute] != null) {
        var len = leaderboardText[scoreAttribute].length;
        for (i=0; i<len; i++) {
            if (leaderboardText[scoreAttribute][i].studentId === studentId && leaderboardText[scoreAttribute][i].score == score)
                scoreIndex = i;
        }
    }

    return scoreIndex;
}

initCAGame();

// retry hooks
function initRetryLoaders(game, context, cb) {
    var retries = parent.window.gameBridge ? parent.window.gameBridge.info.numberOfRetries : 1;
    game.load.onFileError.add(fileError, context);
    game.load.onLoadComplete.add(loadComplete.bind(context, cb, retries, game), context);
}

function fileError(key, file) {
    console.warn('file load error', key, file)
    fileLoadErrors.push(file);

}

function loadComplete(cb, retries, game) {
    if (fileLoadErrors.length) {
        console.warn("Load Complete w/ errors", retries, ' retries remaining');
        if (retries) {
            retryLoadFailures(cb, --retries, game);
        }
    } else {
        if (cb) {
            cb();
        }
    }
}

function retryLoadFailures(cb, retries, game){
    loader = new Phaser.Loader(game);
    loader.onFileError.add(fileError, this);
    loader.onLoadComplete.add(loadComplete.bind(this, cb, retries, game), this);
    var timestamp = Date.now().toString();

    while (fileLoadErrors.length) {
        var file = fileLoadErrors.pop();
        var url = file.url + '?ts=' + timestamp
        console.log('retrying', file)
        if (file.type === 'spritesheet') {
            loader[file.type](file.key, url, file.frameWidth, file.frameHeight, file.frameMax);
        } else {
            loader[file.type](file.key, url);
        }
    };
    loader.start();
}

const monkeyPatches = {
    // The Touch events in Phaser v2.6.2 did not ensure that the event was `cancelable` before attempting to invoke
    // preventDefault.  The code below adds that check to the original event handlers which can be found at
    // https://github.com/photonstorm/phaser/blob/v2.6.2/src/input/Touch.js#L247-L441
    Touch: [
        /**
         * The internal method that handles the touchstart event from the browser.
         * @method Phaser.Touch#onTouchStart
         * @param {TouchEvent} event - The native event from the browser. This gets stored in Touch.event.
         */
        function onTouchStart(Touch) {
            Touch.prototype.onTouchStart = function(event) {
                var i = this.touchLockCallbacks.length;

                while (i--) {
                    var cb = this.touchLockCallbacks[i];

                    if (!cb.onEnd && cb.callback.call(cb.context, this, event)) {
                        this.touchLockCallbacks.splice(i, 1);
                    }
                }

                this.event = event;

                if (!this.game.input.enabled || !this.enabled) {
                    return;
                }

                if (this.touchStartCallback) {
                    this.touchStartCallback.call(this.callbackContext, event);
                }

                // PATCH due to https://github.com/photonstorm/phaser/issues/3915
                if (this.capture && event.cancelable) {
                    event.preventDefault();
                }

                //  event.targetTouches = list of all touches on the TARGET ELEMENT (i.e. game dom element)
                //  event.touches = list of all touches on the ENTIRE DOCUMENT, not just the target element
                //  event.changedTouches = the touches that CHANGED in this event, not the total number of them
                for (var i = 0; i < event.changedTouches.length; i++) {
                    this.game.input.startPointer(event.changedTouches[i]);
                }
            };
            return Touch;
        },


        /**
         * The handler for the touchend events.
         * @method Phaser.Touch#onTouchEnd
         * @param {TouchEvent} event - The native event from the browser. This gets stored in Touch.event.
         */
        function onTouchEnd(Touch) {
            Touch.prototype.onTouchEnd = function (event) {
                var i = this.touchLockCallbacks.length;

                while (i--) {
                    var cb = this.touchLockCallbacks[i];

                    if (cb.onEnd && cb.callback.call(cb.context, this, event)) {
                        this.touchLockCallbacks.splice(i, 1);
                    }
                }

                this.event = event;

                if (this.touchEndCallback) {
                    this.touchEndCallback.call(this.callbackContext, event);
                }

                // PATCH due to https://github.com/photonstorm/phaser/issues/3915
                if (this.capture && event.cancelable) {
                    event.preventDefault();
                }

                //  For touch end its a list of the touch points that have been removed from the surface
                //  https://developer.mozilla.org/en-US/docs/DOM/TouchList
                //  event.changedTouches = the touches that CHANGED in this event, not the total number of them
                for (var i = 0; i < event.changedTouches.length; i++) {
                    this.game.input.stopPointer(event.changedTouches[i]);
                }
            };
            return Touch;
        }
    ],
};

/**
 * Applies monkey patches for each key that an entry in the monkeyPatches mapping.
 * @param {Object} dependencies
 * @returns {Object} dependencies with monkey patches applied
 */
function applyMonkeyPatches(dependencies) {
    Object.keys(dependencies).forEach(dependency => {
        const patches = monkeyPatches[dependency];
        if (patches && patches.length) {
            patches.forEach(patch => (dependencies[dependency] = patch(dependencies[dependency])));
        }
    });
    return dependencies;
}
