/**
 * sails-model-builder.js
 *
 * @description :: utility class that allows you to build you sails models quickly and efficiently
 * @docs        :: http://sailsjs.org/#!documentation/models
 */

var _ = require('lodash');
var uuid = require('node-uuid');

// mayordomo event manager (https://github.com/kdelmonte/mayordomo)
var mayordomo = require('mayordomo');

// List sails model lifecycles. We will use these later 
// to create subscribable events for each one
var lifecycles = [
  'beforeValidate',
  'afterValidate',
  'beforeCreate',
  'afterCreate',
  'beforeUpdate',
  'afterUpdate',
  'beforeDestroy',
  'afterDestroy'
];

// Create a whitelist of properties to copy from mayordomo
// This is a combination of the mayordomo event methods (on, off, trigger)
// and the sails model lifecycles
var mayordomoEvents = _.flatten(['on', 'off', 'trigger', lifecycles]);

module.exports = function () {
  // Create new instance of event manager
  var eventManager = mayordomo.new();
  
  // Sets up the lifecycle callbacks of Sails models as subscribable events
  // See more here: http://sailsjs.org/documentation/concepts/models-and-orm/lifecycle-callbacks
  function setupLifecycleEvents () {
    
    // Go through all Sails models lifecycles
    _.each(lifecycles, function (lifecycleName) {
      
      // Setup the lifecycle callabck as a function that will be 
      // responsible for triggering the event handlers
      workingModel[lifecycleName] = function (instance, cb) {
        // If nobody has subscribed to this lifecycle, run callback immediately
        if (!eventManager.any(lifecycleName)) {
          cb();
          return;
        }
        
        // `orphanCallback` will allow us to know if any of the handlers called the cb() callback
        // of the lifecycle
        var orphanCallback = true;
        
        // the `adopt` callback lets us know that the user assumed responsibility of running the callback
        var adopt = function () {
          orphanCallback = false;
        };
        
        // Wrap sails callback in order to know if any handlers ran or plan to run the callback manually
        var wrappedCb = _.wrap(cb, function (fx, message) {
          // This callback is not an orphan anymore
          adopt();
          
          // Run the sails lifecycle cb()
          fx(message);
        });
        
        // Trigger all event handlers of this lifecycle
        eventManager.trigger(lifecycleName, [instance, wrappedCb, adopt]);
        
        // If the lifecycle cb() did not run, let's run it to get the response out of limbo
        if (orphanCallback) {
          cb();
        }
      };
    });
  
  
    return this;
  }

  // Declare the events (with shortcuts) in the event manager
  eventManager.declare(lifecycles, true);

  // Declare the working model
  var workingModel = {
    attributes: {}
  };

  var modelBuilder = {    
    // Sets or retrieves the working model
    model: function (model) {
      // If no arguments were passed, then this is just a getter
      if (!arguments.length) return workingModel;
      
      // Assign the model as the working model 
      workingModel = model;
      
      // If the model that was passed does not contain attributes,
      // then set the attributes as an empty object
      if (!workingModel.attributes) {
        workingModel.attributes = {};
      }
      
      // Setup the lifecycle events
      setupLifecycleEvents(workingModel);

      return this;
    },
    // Adds the `id` attribute as an UUID to the working model
    uuidKey: function () {
      workingModel.attributes.id = {
        type: 'string',
        unique: true,
        primaryKey: true,
        defaultsTo: function () {
          return uuid.v4();
        }
      };

      return this;
    },
    // Adds the `id` attribute as an integer to the working model
    intKey: function (autoIncrement) {
      workingModel.attributes.id = {
        type: 'integer',
        unique: true,
        primaryKey: true,
        autoIncrement: autoIncrement === undefined ? true : autoIncrement
      };

      return this;
    },
    // Sets a list of attributes as required. 
    // If no list is provided, all attributes will be marked as required. 
    require: function () {
      var attributeNames;
      if (!arguments.length) {
        // Since no arguments were passed, get all the current attribute names
        attributeNames = _.keys(workingModel.attributes);
      } else {
        // If the first argument is an array then use it.
        // Otherwise use the entire arguments object as the list
        if (_.isArray(arguments[0])) {
          attributeNames = arguments[0]
        } else {
          attributeNames = _.toArray(arguments);
        }
      }
      
      // Make the specified attributes required
      modelBuilder.attr(attributeNames, {
        required: true
      });

      return this;
    },
    // Sets or extends attributes of the working model
    // This method supports three overloads:
    // 1) One that accepts an attributes object
    //  Example: .attr({name: {type: 'string', maxLength: 45}})
    // 2) One that accepts an attribute name, a property name, and a property value
    //  Example: .attr('name', 'type', 'string')
    // 3) One that accepts a list of attribute names and an object that contains shared properties between those attributes
    //  Example: .attr(['parentId','childId'],{type: 'string',minLength: 36, maxLength: 36})
    attr: function (attributes, sharedProperties, value) {
      var currentAttribute;
      
      // If the first argument is an object, then we are dealing with overload #1
      if (!_.isArray(attributes) && _.isObject(attributes)) {
        // Loop through all the attributes
        _.each(attributes, function (attribute, attributeName) {
          // Get the existing attribute from the working model
          // If none is found then set it as an empty object
          currentAttribute = workingModel.attributes[attributeName] || {};
          
          // If current attribute is not a function, then extend it.
          // Otherwise, leave it alone
          if (!_.isFunction(attribute)) {
            _.extend(currentAttribute, attribute);
          } else {
            currentAttribute = attribute;
          }
          
          // Set the new extended attribute to the working model
          workingModel.attributes[attributeName] = currentAttribute;
        });
        
        return this;
      }

      // If three arguments were passed, then we are dealing with overload #2
      if (arguments.length === 3) {
        // The first argument is the attribute name
        var attributeName = arguments[0];
        
        // The second attribute is the property name
        var propertyName = arguments[1];
        
        // Get the existing attribute from the working model
        // If none is found then set it as an empty object
        currentAttribute = workingModel.attributes[attributeName] || {};
        
        // Set the the value to the target property
        currentAttribute[propertyName] = value;
        
        // Set the updated attribute to the working model
        workingModel.attributes[attributeName] = currentAttribute;
        
        return this;
      }
      
      // If we are here, then we are dealing with overload #3
      // If the user passed in a single attribute name in the first argument
      // then let's put it inside of an array to handle it the same way below
      if (!_.isArray(attributes)) {        
        attributes = [attributes];
      }
      
      // Go through all the attribute names that were passed
      _.each(attributes, function (attributeName) {
        // Get the existing attribute from the working model
        // If none is found then set it as an empty object
        currentAttribute = workingModel.attributes[attributeName] || {};
        
        // Copy over all the shared properties
        _.extend(currentAttribute, sharedProperties);
        
        // Set the new extended attribute to the working model
        workingModel.attributes[attributeName] = currentAttribute;
      });
      
      return this;
    },
    // Sets the working model as the exports of the module that is passed in
    export: function (to) {
      to.exports = workingModel;

      return this;
    }
  };

  // Extend model builder with certain members of the event manager
  _.extend(modelBuilder, _.pick(eventManager, function (value, key) {
    return _.contains(mayordomoEvents, key);
  }));

  // Setup chaining object to `modelBuilder` in `eventManager` so that
  // when users call on() or any other of the methods copied over from the
  // `eventManager` they will get the `modelBuilder` to continue chaining
  eventManager.chain(modelBuilder);

  // Finally, return the modelBuilder
  return modelBuilder;
};
