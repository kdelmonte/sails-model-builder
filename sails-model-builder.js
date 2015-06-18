/**
 * sails-model-builder.js
 *
 * @description :: utility class that allows you to build you sails models quickly and efficiently
 * @docs        :: http://sailsjs.org/#!documentation/models
 */

var _ = require('lodash');
var uuid = require('node-uuid');

// Setup lifecycle events in mayordomo for event management
var lifeCycles = [
  'beforeValidate',
  'afterValidate',
  'beforeCreate',
  'afterCreate',
  'beforeUpdate',
  'afterUpdate',
  'beforeDestroy',
  'afterDestroy'
];

// Create a whitelist of properties to copy from rodnis
// This is a combination of the rodnis standard event method
// and the addition of sails model lifecycles
var mayordomoEvents = _.flatten(['on', 'off', 'trigger', lifeCycles])

module.exports = function () {
  var mayordomo = require('mayordomo').new();

  // Declare the events in mayordomo
  mayordomo.declare(lifeCycles, true);

  var modelBuilder = {
    create: function (model) {
      if (!model) model = {};
      modelBuilder.currentModel = model;
      if (!modelBuilder.currentModel.attributes) {
        modelBuilder.currentModel.attributes = {};
      }
      modelBuilder.setUpLifecycleEvents();
      return this;
    },
    model: function () {
      return modelBuilder.currentModel;
    },
    uuidKey: function () {
      modelBuilder.currentModel.attributes.id = {
        type: 'string',
        unique: true,
        primaryKey: true,
        defaultsTo: function () {
          return uuid.v4();
        }
      };
      return this;
    },
    intKey: function (autoIncrement) {
      modelBuilder.currentModel.attributes.id = {
        type: 'integer',
        unique: true,
        primaryKey: true,
        autoIncrement: autoIncrement === undefined ? true : autoIncrement
      };
      return this;
    },
    require: function () {
      var list;
      if (!arguments.length) {
        list = _.keys(modelBuilder.currentModel.attributes);
      } else {
        // If the first argument is an array then use it.
        // Otherwise use the entire arguments object as the list
        if(_.isArray(arguments[0])){
          list = arguments[0]
        }else{
          list = _.toArray(arguments);
        }

      }
      return modelBuilder.attr(list, {
        required: true
      });
    },
    attr: function (attributes, sharedProperties, value) {
      var currentAttribute;
      if (!_.isArray(attributes) && _.isObject(attributes)) {
        _.each(attributes, function (attribute, attributeName) {
          currentAttribute = modelBuilder.currentModel.attributes[attributeName] || {};
          //If the value of the attribute is not a function, then extend it.
          // Otherwise, leave it alone
          if(!_.isFunction(attribute)){
            _.extend(currentAttribute, attribute);
          }else{
            currentAttribute = attribute;
          }
          modelBuilder.currentModel.attributes[attributeName] = currentAttribute;
        });
        return this;
      }

      if (arguments.length === 3) {
        var attributeName = attributes;
        var propertyName = sharedProperties;
        currentAttribute = modelBuilder.currentModel.attributes[attributeName] || {};
        currentAttribute[propertyName] = value;
        modelBuilder.currentModel.attributes[attributeName] = currentAttribute;
      }

      if (!_.isArray(attributes)) {
        attributes = [attributes];
      }
      _.each(attributes, function (attributeName) {
        currentAttribute = modelBuilder.currentModel.attributes[attributeName] || {};
        _.extend(currentAttribute, sharedProperties);
        modelBuilder.currentModel.attributes[attributeName] = currentAttribute;
      });
      return this;
    },
    setUpLifecycleEvents: function () {
      _.each(lifeCycles, function (lc) {
        modelBuilder.currentModel[lc] = function (instance, cb) {
          // If nobody has subscribed to this lifecycle, run callback immediately
          if (!mayordomo.any(lc)) {
            cb();
            return;
          }
          var orphanCallback = true;
          // Adopt callback lets us know that user assumes responsibility of running the callback
          var adopt = function(){
            orphanCallback = false;
          };
          // Wrap sails callback in order to know if any handlers ran or plan to run the callback manually

          var wrappedCb = _.wrap(cb, function (fx, message) {
            adopt();
            fx(message);
          });
          mayordomo.trigger(lc, [instance, wrappedCb, adopt]);
          // If the callback did not run, let's run it to get the response out of limbo
          if (orphanCallback) {
            cb();
          }
        };
      });
      return this;
    },
    export: function (to) {
      to.exports = modelBuilder.currentModel;
      return this;
    }
  };

  // Extend model builder with mayordomo event dispatcher
  _.extend(modelBuilder, _.pick(mayordomo, function (value, key) {
    return _.contains(mayordomoEvents, key);
  }));
  modelBuilder.declareEvent = mayordomo.declare;

  // Setup chaining object to `modelBuilder` in mayordomo
  mayordomo.chain(modelBuilder);

  return modelBuilder;
};
