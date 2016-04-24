# sails-model-builder

sails-model-builder allows you to take the code over configuration approach when building your Sails models. It also sets up event handlers for all lifecycle callbacks of your models.

## Install

`npm install sails-model-builder --save`

## Usage

A sails model usually looks like this:

    var uuid = require('node-uuid');
    var bcrypt = require('bcrypt');

    module.exports = {
      id: {
        type: 'string',
        unique: true,
        primaryKey: true,
        defaultsTo: function () {
          return uuid.v4();
        }
      },
      firstName: {
        type: 'string',
        required: true
      },
      lastName: {
        type: 'string',
        required: true
      },
      email: {
        type: 'string',
        required: true
      },
      phoneNumber: {
        type: 'string',
        required: true
      },
      beforeCreate: function (values, cb) {
        bcrypt.hash(values.password, 10, function(err, hash) {
          if(err) return cb(err);
          values.password = hash;
          cb();
        });
      }

    };

Using the model builder you can rewrite it like this:

    var modelBuilder = require('sails-model-builder')();
    var bcrypt = require('bcrypt');

    modelBuilder
    .uuidKey()
    .attr(['firstName', 'lastName', 'email', 'phoneNumber'], {
      type: 'string',
      required: true`
    })
    .beforeCreate(function(values, cb, adoptCb){
      adoptCb();
      bcrypt.hash(values.password, 10, function(err, hash) {
        if(err) return cb(err);
        values.password = hash;
        cb();
      });
    })
    .export(module);

## API

### model([model])

Sets or retrieves the working model

    // Get the model
    var myModel = modelBuilder.model();

    // Set the model
    modelBuilder.model({
      attributes: {
        name: {
          type: 'string'
        }
      }
    })

### uuidKey()

Adds the `id` attribute as an UUID to the working model

    modelBuilder.uuidKey();

    // Added the following attribute to the model
    id: {
      type: 'string',
      unique: true,
      primaryKey: true,
      defaultsTo: function () {
        return uuid.v4();
      }
    }

### intKey([autoIncrement])

Adds the `id` attribute as an integer to the working model

    modelBuilder.uuidKey(true);

    // Added the following attribute to the model
    id: {
      type: 'integer',
      unique: true,
      primaryKey: true,
      autoIncrement: autoIncrement === undefined ? true : autoIncrement
    }

### require([attributeNameList])

Takes all the attributes passed in and marks them as required. If this method is called without arguments, then all attributes will be marked as required.

    // Pass the attributes as individual arguments
    modelBuilder.require('firstName', 'lastName');

    // or as an array
    modelBuilder.require(['firstName', 'lastName']);

    // mark all attributes as required
    modelBuilder.require();

### attr()

Sets a new attribute or extends it if it already exists. This method supports three overloads:

1) One that accepts an attributes object

    modelBuilder.attr({
      name: {
        type: 'string',
        maxLength: 45
      }
    });

2) One that accepts an attribute name, a property name, and a property value

    modelBuilder.attr('name', 'type', 'string');
    modelBuilder.attr('name', 'maxLength', 45);

3) One that accepts a list of attribute names and an object that contains shared properties between those attributes

    modelBuilder.attr(['firstName','lastName'],{
        type: 'string',
        required: true,
        maxLength: 50
      }
    )

### export(module)

Sets the working model as the exports of the module that is passed in

    modelBuilder
      .attr({
        name: {
          type: 'string',
          maxLength: 45
        }
      })
      .export(module);

## Event Handling & Lifecycles

Read about the lifecycles of a sails model [here](http://sailsjs.org/documentation/concepts/models-and-orm/lifecycle-callbacks).

sails-model-builder provides events for all lifecycles of a sails model. You can subscribe to these events like you would subscribe to a jQuery event.

**Note**: Notice how you do not have to call `cb` in the example below. If you do not call it yourself, sails-model-builder will call it for you after all event handlers have been run. This is **NOT** the case if you are running an async operation; for that, see the next section.

    modelBuilder
      .attr({
        username: {
          type: 'string',
          required: true
        },

        password: {
          type: 'string',
          minLength: 6,
          required: true,
          columnName: 'encrypted_password'
        }
      })
      // You could also do beforeCreate()
      .on('beforeCreate', function (values) {
        values.password = syncEncryptPassword(values.password);
      });
    })


### Asynchronous operations

By default, if you don't call `cb` yourself, sails-model-builder will run it after all your event handlers have been triggered. If you wish to assume the responsibility of executing the callback yourself (maybe after some async operation completes), then you must execute the `assumeCb` callback that sails-model-builder passes to your event handler. This callback simply lets sails-model-builder know not to execute the `cb` for you. See the following example:

    var bcrypt = require('bcrypt');
    modelBuilder
      .attr({
        username: {
          type: 'string',
          required: true
        },

        password: {
          type: 'string',
          minLength: 6,
          required: true,
          columnName: 'encrypted_password'
        }
      })
      .beforeCreate(function (values, cb, assumeCb) {
        // Let sails-model-builder know that you will execute
        // the cb callback sometime in the future
        assumeCb();

        // Encrypt password
        bcrypt.hash(values.password, 10, function(err, hash) {
          if(err) return cb(err);
          values.password = hash;
          cb();
      });
    })

## Contributing

If you would like to contribute, please do so in the development branch.
