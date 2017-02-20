'use strict'

const Hoek = require('hoek')

const internals = {}

internals.defaults = {
  stripQuotes: false,
  messages: {}
}

const Relish = function Relish (opts) {
  this.exports = {}
  this._opts = opts ? Hoek.applyToDefaults(internals.defaults, opts) : internals.defaults

  this.parseError = (error) => {
    return error.data.details.map((i) => {

      let err = {
        key: i.path.split('.').pop(),
        path: i.path,
        message: this._opts.stripQuotes ? i.message.replace(/"/g, '') : i.message,
        type: i.type.split('.').shift(),
        constraint: i.type.split('.').pop()
      }
      // if label is different than key, provide label
      if (i.context.key !== err.key) {
        err.label = i.context.key
      }

      // set custom message (if exists)
      if (this._opts.messages.hasOwnProperty(err.path)) {
        err.message = this._opts.messages[err.path]
      } else if (this._opts.messages.hasOwnProperty(err.key)) {
        err.message = this._opts.messages[err.key];
      } else {
        //loop through the messages object to math path using regex
        for (var relishPath in this._opts.messages) {
          if (this._opts.messages.hasOwnProperty(relishPath)) {

            this._opts.regexObj = this._opts.regexObj || {};

            //Adds ^ at start and $ at the end to match exact path and make regex as path
            let newRelishPath = this._opts.regexObj[relishPath] || this.addRegex(relishPath);

            //if path matches with object's property
            if (err.path.match(newRelishPath)) {
              err.message = this._opts.messages[relishPath];
            }
          }
        }
      }
      //Overwrite error message with constraint specific error messsage
      err.message = err.message[err.constraint] || err.message['default'] || err.message;
      //Adding interaction number if present
      err.path = this.addPath(err.path, error);

      return err
    })
  }

  this.formatResponse = (error, source, errorMessage, errors) => {
    // append errors array to response
    error.output.payload.message = errorMessage
    error.output.payload.validation = {
      source: source,
      errors: errors
    }

    return error
  }

  this.exports.options = (opts) => {
    this._opts = Hoek.applyToDefaults(this._opts, opts)

    return this.exports
  }

  this.exports.failAction = (request, reply, source, error) => {

    // parse error object
    const errors = this.parseError(error);

    // build main error message
    const errorMessage = errors.map((e) => JSON.stringify(e.message)).join(', ');

    // format error response
    error = this.formatResponse(error, source, errorMessage, errors);

    return reply(error)
  }
  /**
   * Adds ^ before path and $ at the end if not present
   * @param relishPath
   * @returns {RegExp}
   */
  this.addRegex = (relishPath) => {

    //Add ^ in beginning if not present
    if (!relishPath.startsWith('^')) {
      relishPath = '^' + relishPath;
    }
    //Add $ in end if not present
    if (!relishPath.endsWith('$')) {
      relishPath = relishPath + '$';
    }

    return new RegExp(relishPath);
  }
  /**
   * Adds full path with the existing path
   * @param errorPath
   * @param error
   * @returns errorPath
   */
  this.addPath = (errorPath, error) => {

    if (error.data.path) {
      errorPath = error.data.path + '.' + errorPath;
    }
    return errorPath;
  }

  return this.exports
}

module.exports = (opts) => new Relish(opts)
