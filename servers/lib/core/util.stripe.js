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
        // Setup the Stripe params
        var params = {};

        // Call the Stripe customers.create API
        this.stripe.customers.create( params, function( err, result ) {
            if( err ) {
                console.error( "Stripe Utility Error - failed to create a new customer: ", params, err );
                reject( err );
            }
            else {
                console.log( "Stripe Utility Successfully created a Customer: ", result );
                resolve( result );
            }
        });
    }.bind(this));
};

StripeUtil.prototype.retrieveCustomer = function() {
    return when.promise(function(resolve, reject) {
        // Setup the Stripe customer Id
        var customerId = "";

        // Call the Stripe customers.retrieve API
        this.stripe.customers.retrieve( customerId, function( err, result ) {
            if( err ) {
                console.error( "Stripe Utility Error - failed to retrieve the customer: ", customerId, err );
                reject( err );
            }
            else {
                console.log( "Stripe Utility Successfully retrieved the Customer: ", customerId, result );
                resolve( result );
            }
        });
    }.bind(this));
};

StripeUtil.prototype.updateCustomer = function() {
    return when.promise(function(resolve, reject) {
        // Setup the Stripe customer Id and params
        var customerId = "";
        var params = {};

        // Call the Stripe customers.update API
        this.stripe.customers.update( customerId, params, function( err, result ) {
            if( err ) {
                console.error( "Stripe Utility Error - failed to update the customer: ", customerId, params, err );
                reject( err );
            }
            else {
                console.log( "Stripe Utility Successfully updated the Customer: ", customerId, params, result );
                resolve( result );
            }
        });
    }.bind(this));
};

/*
 * Subscription APIs
 */
StripeUtil.prototype.createSubscription = function() {
    return when.promise(function(resolve, reject) {
        // Setup the Stripe customer Id and params
        var customerId = "";
        var params = {};

        // Call the Stripe customers.createSubscription API
        this.stripe.customers.createSubscription( customerId, params, function( err, result ) {
            if( err ) {
                console.error( "Stripe Utility Error - failed to create a new subscription: ", customerId, params, err );
                reject( err );
            }
            else {
                console.log( "Stripe Utility Successfully created a Subscription: ", customerId, params, result );
                resolve( result );
            }
        });
    }.bind(this));
};

StripeUtil.prototype.retrieveSubscription = function() {
    return when.promise(function(resolve, reject) {
        // Setup the Stripe customer Id and subscription Id
        var customerId = "";
        var subscriptionId = "";

        // Call the Stripe customers.retrieveSubscription API
        this.stripe.customers.retrieveSubscription( customerId, subscriptionId, function( err, result ) {
            if( err ) {
                console.error( "Stripe Utility Error - failed to retrieve the subscription: ", customerId, subscriptionId, err );
                reject( err );
            }
            else {
                console.log( "Stripe Utility Successfully retrieved the Subscription: ", customerId, subscriptionId, result );
                resolve( result );
            }
        });
    }.bind(this));
};

StripeUtil.prototype.updateSubscription = function() {
    return when.promise(function(resolve, reject) {
        // Setup the Stripe customer Id, subscription Id, and params
        var customerId = "";
        var subscriptionId = "";
        var params = {};

        // Call the Stripe customers.updateSubscription API
        this.stripe.customers.updateSubscription( customerId, subscriptionId, params, function( err, result ) {
            if( err ) {
                console.error( "Stripe Utility Error - failed to update the subscription: ", customerId, subscriptionId, params, err );
                reject( err );
            }
            else {
                console.log( "Stripe Utility Successfully updated the Subscription: ", customerId, subscriptionId, params, result );
                resolve( result );
            }
        });
    }.bind(this));
};

StripeUtil.prototype.cancelSubscription = function() {
    return when.promise(function(resolve, reject) {
        // Setup the Stripe customer Id and subscription Id
        var customerId = "";
        var subscriptionId = "";

        // Call the Stripe customers.cancelSubscription API
        this.stripe.customers.cancelSubscription( customerId, subscriptionId, function( err, result ) {
            if( err ) {
                console.error( "Stripe Utility Error - failed to cancel the subscription: ", customerId, subscriptionId, err );
                reject( err );
            }
            else {
                console.log( "Stripe Utility Successfully canceled the Subscription: ", customerId, subscriptionId, result );
                resolve( result );
            }
        });
    }.bind(this));
};

/*
 * Plan APIs
 */
StripeUtil.prototype.retrievePlan = function() {
    return when.promise(function(resolve, reject) {
        // Setup the Stripe plan Id
        var planId = "";

        // Call the Stripe plans.retrieve API
        this.stripe.plans.retrieve( planId, function( err, result ) {
            if( err ) {
                console.error( "Stripe Utility Error - failed to retrieve the plan: ", planId, err );
                reject( err );
            }
            else {
                console.log( "Stripe Utility Successfully retrieved the Plan: ", planId, result );
                resolve( result );
            }
        });
    }.bind(this));
};

StripeUtil.prototype.listPlans = function() {
    return when.promise(function(resolve, reject) {
        // Call the Stripe plans.list API
        this.stripe.plans.list( function( err, result ) {
            if( err ) {
                console.error( "Stripe Utility Error - failed to list the plans: ", err );
                reject( err );
            }
            else {
                console.log( "Stripe Utility Successfully listed the Plans: ", result );
                resolve( result );
            }
        });
    }.bind(this));
};