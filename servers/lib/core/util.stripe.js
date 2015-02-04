var fs             = require('fs');
var path           = require('path');
var _              = require('lodash');
var when           = require('when');
var stripe         = require('stripe');

module.exports = StripeUtil;

// https://stripe.com/docs/api

function StripeUtil(options){
    // Get the Stripe config
    this.options = options;

    // Set the Stripe config
    if( !this.options.stripe ) {
        console.error( "Stripe Utility Error - you do not have Stripe configured!" );
        return;
    }

    // Set the Stripe object
    this.stripe = new stripe( this.options.stripe.test.secretKey );
}


/*
 * Customer APIs
 */
StripeUtil.prototype.createCustomer = function() {
    return when.promise(function(resolve, reject) {
        resolve();
    }.bind(this));
};

StripeUtil.prototype.retrieveCustomer = function() {
    return when.promise(function(resolve, reject) {
        resolve();
    }.bind(this));
};

StripeUtil.prototype.updateCustomer = function() {
    return when.promise(function(resolve, reject) {
        resolve();
    }.bind(this));
};

/*
 * Subscription APIs
 */
StripeUtil.prototype.createSubscription = function() {
    return when.promise(function(resolve, reject) {
        resolve();
    }.bind(this));
};

StripeUtil.prototype.retrieveSubscription = function() {
    return when.promise(function(resolve, reject) {
        resolve();
    }.bind(this));
};

StripeUtil.prototype.updateSubscription = function() {
    return when.promise(function(resolve, reject) {
        resolve();
    }.bind(this));
};

StripeUtil.prototype.deleteSubscription = function() {
    return when.promise(function(resolve, reject) {
        resolve();
    }.bind(this));
};

/*
 * Plan APIs
 */
StripeUtil.prototype.retrievePlan = function() {
    return when.promise(function(resolve, reject) {
        resolve();
    }.bind(this));
};

StripeUtil.prototype.listPlans = function() {
    return when.promise(function(resolve, reject) {
        resolve();
    }.bind(this));
};