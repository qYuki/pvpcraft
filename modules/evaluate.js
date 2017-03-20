/**
 * Created by macdja38 on 2016-04-25.
 */
"use strict";

let colors = require('colors');

let request = require('request');

let now = require("performance-now");

let SlowSender = require('../lib/SlowSender');

//noinspection JSUnusedLocalSymbols
let Eris = require('eris');
let utils = require('../lib/utils');
let util = require('util');

class evaluate {
  /**
   * Instantiates the module
   * @constructor
   * @param {Object} e
   * @param {Eris} e.client Eris client
   * @param {Config} e.config File based config
   * @param {Raven?} e.raven Raven error logging system
   * @param {Config} e.auth File based config for keys and tokens and authorisation data
   * @param {ConfigDB} e.configDB database based config system, specifically for per guild settings
   * @param {R} e.r Rethinkdb r
   * @param {Permissions} e.perms Permissions Object
   * @param {Feeds} e.feeds Feeds Object
   * @param {MessageSender} e.messageSender Instantiated message sender
   * @param {SlowSender} e.slowSender Instantiated slow sender
   * @param {PvPClient} e.pvpClient PvPCraft client library instance
   */
  constructor(e) {
    this.e = e;
    this.client = e.client;
    this.modules = e.modules;
    this.config = e.config;
    this.r = e.r;
    this.configDB = e.configDB;
    this.pvpClient = e.pvpClient;
    this.messageSender = e.messageSender;
    this.fileConfig = e.config;
    this.slowSender = new SlowSender(e);
  }

  static getCommands() {
    return ["eval", "setavatar"];
  }

  onReady() {
    this.slowSender.onReady();
  }

  onDisconnect() {
    this.slowSender.onDisconnect();
  }

  //noinspection JSUnusedLocalSymbols
  /**
   * Called with a command, returns true or a promise if it is handling the command, returns false if it should be passed on.
   * @param {Message} msg
   * @param {Command} command
   * @param {Permissions} perms
   * @returns {boolean | Promise}
   */
  onCommand(msg, command, perms) {
    //id is hardcoded to prevent problems stemming from the misuse of eval.
    //no perms check because this extends paste the bounds of a server.
    //if you know what you are doing and would like to use the id in the config file you may replace msg.author.id == id, with
    //this.config.get("permissions", {"permissions": {admins: []}}).admins.includes(msg.author.id)
    if (command.command === "eval" && msg.author.id === "85257659694993408") {
      let code = command.args.join(" ");

      //these are so that others code will run in the eval if they depend on things.
      //noinspection JSUnusedLocalSymbols
      let client = this.client;
      //noinspection JSUnusedLocalSymbols
      let bot = this.client;
      let message = msg;
      //noinspection JSUnusedLocalSymbols
      let config = this.config;
      //noinspection JSUnusedLocalSymbols
      let slowSend = this.slowSender;
      //noinspection JSUnusedLocalSymbols
      let raven = this.raven;
      //noinspection JSUnusedLocalSymbols
      let modules = this.modules;
      //noinspection JSUnusedLocalSymbols
      let guild = message.channel.guild;
      //noinspection JSUnusedLocalSymbols
      let channel = msg.channel;
      let t0, t1, t2;
      t0 = now();
      try {
        t0 = now();
        let evaluated = eval(code);
        t1 = now();
        let string = "```xl\n" +
          utils.clean(code) +
          "\n- - - - - - evaluates-to- - - - - - -\n" +
          utils.clean(this._shortenTo(this._convertToObject(evaluated), 1500)) +
          "\n- - - - - - - - - - - - - - - - - - -\n" +
          "In " + (t1 - t0) + " milliseconds!\n```";
        if (evaluated && evaluated.then) {
          evaluated.catch(() => {
          }).then(() => {
            t2 = now();
          })
        }

        this.client.createMessage(msg.channel.id, string).then(message => {
          if (evaluated && evaluated.then) {
            evaluated.catch((error) => {
              string = string.substring(0, string.length - 4);
              string += "\n- - - - - Promise throws- - - - - - -\n";
              string += utils.clean(error);
              string += "\n- - - - - - - - - - - - - - - - - - -\n";
              string += "In " + (t2 - t0) + " milliseconds!\n```";
              this.client.editMessage(message.channel.id, message.id, string).catch(error => console.error(error));
            }).then((result) => {
              string = string.substring(0, string.length - 4);
              string += "\n- - - - -Promise resolves to- - - - -\n";
              string += utils.clean(this._shortenTo(this._convertToObject(result), 1500));
              string += "\n- - - - - - - - - - - - - - - - - - -\n";
              string += "In " + (t2 - t0) + " milliseconds!\n```";
              this.client.editMessage(message.channel.id, message.id, string).catch(error => console.error(error));
            }).catch(error => console.error(error))
          }
        });
        console.log(evaluated);
      }
      catch (error) {
        t1 = now();
        this.client.createMessage(msg.channel.id, "```xl\n" +
          utils.clean(code) +
          "\n- - - - - - - errors-in- - - - - - - \n" +
          utils.clean(error) +
          "\n- - - - - - - - - - - - - - - - - - -\n" +
          "In " + (t1 - t0) + " milliseconds!\n```");
        console.error(error);
      }
      return true;
    }

    if (command.command === "setavatar" && this.fileConfig.get("permissions", {"permissions": {admins: []}}).admins.includes(msg.author.id)) {
      request({
        method: 'GET',
        url: command.args[0],
        encoding: null
      }, (err, res, image) => {
        if (err) {
          this.client.createMessage(msg.channel.id, "Failed to get a valid image.");
          return true;
        }
        this.client.setAvatar(image, (err) => {
          if (err) {
            this.client.createMessage(msg.channel.id, "Failed setting avatar.");
            return true;
          }
          this.client.createMessage(msg.channel.id, "Changed avatar.");
        });
      });
      return true;
    }

    return false;
  }

  /**
   *
   * @param {string} string
   * @param {number} charCount
   * @returns {string}
   * @private
   */
  _shortenTo(string, charCount) {
    return string.slice(0, charCount);
  }

  /**
   * Converts to string
   * @param {Object?} object
   * @returns {string}
   * @private
   */
  _convertToObject(object) {
    if (object === null) return "null";
    if (typeof object === "undefined") return "undefined";
    if (object.toJSON && typeof object.toJSON ) {
      object = object.toJSON();
    }
    return util.inspect(object, {depth: 2}).replace(new RegExp(this.client.token, "g"), "[ Token ]");
  }
}

//noinspection JSUnusedLocalSymbols (used in eval
function dec2bin(dec){
  return (dec >>> 0).toString(2);
}

module.exports = evaluate;