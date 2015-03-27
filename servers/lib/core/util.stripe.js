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

    // Set the Stripe object to "test" or "live", depending on the setting
    var stripeEnv = "test";
    if( this.options.stripe &&
        this.options.stripe.env ) {
        stripeEnv = this.options.stripe.env;
    }
    this.stripe = new stripe( this.options.stripe[ stripeEnv ].secretKey );
}


/*
 * Customer APIs
 */
StripeUtil.prototype.createCustomer = function( params ) {
    return when.promise(function(resolve, reject) {
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

StripeUtil.prototype.retrieveCustomer = function( customerId ) {
    return when.promise(function(resolve, reject) {
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

StripeUtil.prototype.updateCustomer = function( customerId, params ) {
    return when.promise(function(resolve, reject) {
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

StripeUtil.prototype.deleteCustomer = function( customerId ) {
    return when.promise(function(resolve, reject) {
        // Call the Stripe customers.del API
        this.stripe.customers.del( customerId, function( err, result ) {
            if( err ) {
                console.error( "Stripe Utility Error - failed to delete the customer: ", customerId, err );
                reject( err );
            }
            else {
                console.log( "Stripe Utility Successfully deleted the Customer: ", customerId, result );
                resolve( result );
            }
        });
    }.bind(this));
};

StripeUtil.prototype.listCustomers = function( params ) {
    return when.promise(function(resolve, reject) {
        // Call the Stripe customers.list API
        this.stripe.customers.list( params, function( err, result ) {
            if( err ) {
                console.error( "Stripe Utility Error - failed to list the customers: ", params, err );
                reject( err );
            }
            else {
                //console.log( "Stripe Utility Successfully listed the Customers: ", params, result );
                resolve( result );
            }
        });
    }.bind(this));
};

/*
 * Subscription APIs
 */
StripeUtil.prototype.createSubscription = function( customerId, params ) {
    return when.promise(function(resolve, reject) {
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

StripeUtil.prototype.retrieveSubscription = function( customerId, subscriptionId ) {
    return when.promise(function(resolve, reject) {
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

StripeUtil.prototype.updateSubscription = function( customerId, subscriptionId, params ) {
    return when.promise(function(resolve, reject) {
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

StripeUtil.prototype.cancelSubscription = function( customerId, subscriptionId ) {
    return when.promise(function(resolve, reject) {
        // Call the Stripe customers.updateSubscription API. By passing in a stripe_planId, plan is enabled
        this.stripe.customers.cancelSubscription( customerId, subscriptionId, { at_period_end: true }, function( err, result ) {
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

StripeUtil.prototype.renewSubscription = function( customerId, subscriptionId, params ) {
    return when.promise(function(resolve, reject) {
        // Call the Stripe customers.cancelSubscription API
        this.stripe.customers.updateSubscription( customerId, subscriptionId, params, function( err, result ) {
            if( err ) {
                console.error( "Stripe Utility Error - failed to enable subscription auto-renew: ", customerId, subscriptionId, err );
                reject( err );
            }
            else {
                console.log( "Stripe Utility Successfully Enabled the Subscription Auto-Renew: ", customerId, subscriptionId, result );
                resolve( result );
            }
        });
    }.bind(this));
};

StripeUtil.prototype.listSubscriptions = function( customerId ) {
    return when.promise(function(resolve, reject) {
        // Call the Stripe customers.cancelSubscription API
        this.stripe.customers.listSubscriptions( customerId, function( err, result ) {
            if( err ) {
                console.error( "Stripe Utility Error - failed to list the active subscription: ", customerId, err );
                reject( err );
            }
            else {
                console.log( "Stripe Utility Successfully listed the Active Subscriptions: ", customerId, result );
                resolve( result );
            }
        });
    }.bind(this));
};

/*
 * Plan APIs
 */
StripeUtil.prototype.retrievePlan = function( planId ) {
    return when.promise(function(resolve, reject) {
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

/*
 * Card APIs
 */
StripeUtil.prototype.createCard = function( customerId, params ) {
    return when.promise(function(resolve, reject) {
        // Call the Stripe customers.createCard API
        this.stripe.customers.createCard(customerId, params, function( err, result ) {
            if( err ) {
                console.error( "Stripe Utility Error - failed to create a new card: ", customerId, params, err );
                reject( err );
            }
            else {
                console.log( "Stripe Utility Successfully created a Card: ", customerId, result );
                resolve( result );
            }
        });
    }.bind(this));
};

StripeUtil.prototype.retrieveCard = function( customerId, cardId ) {
    return when.promise(function(resolve, reject) {
        // Call the Stripe customers.retrieveCard API
        this.stripe.customers.retrieveCard( customerId, cardId, function( err, result ) {
            if( err ) {
                console.error( "Stripe Utility Error - failed to retrieve the card: ", customerId, cardId, err );
                reject( err );
            }
            else {
                console.log( "Stripe Utility Successfully retrieved the Card: ", customerId, cardId, result );
                resolve( result );
            }
        });
    }.bind(this));
};

StripeUtil.prototype.updateCard = function( customerId, cardId, params ) {
    return when.promise(function(resolve, reject) {
        // Call the Stripe customers.updateCard API
        this.stripe.customers.updateCard( customerId, cardId, params, function( err, result ) {
            if( err ) {
                console.error( "Stripe Utility Error - failed to update the card: ", customerId, cardId, params, err );
                reject( err );
            }
            else {
                console.log( "Stripe Utility Successfully updated the Card: ", customerId, cardId, params, result );
                resolve( result );
            }
        });
    }.bind(this));
};

/*
 * Coupon APIs
 */
StripeUtil.prototype.createCoupon = function( params ) {
    return when.promise(function(resolve, reject) {
        // Call the Stripe coupons.create API
        this.stripe.coupons.create(params, function( err, result ) {
            if( err ) {
                console.error( "Stripe Utility Error - failed to create a new coupon: ", params, err );
                reject( err );
            }
            else {
                console.log( "Stripe Utility Successfully created a Coupon: ", result );
                resolve( result );
            }
        });
    }.bind(this));
};

StripeUtil.prototype.retrieveCoupon = function( couponId ) {
    return when.promise(function(resolve, reject) {
        // Call the Stripe coupons.retrieveCard API
        this.stripe.coupons.retrieve( couponId, function( err, result ) {
            if( err ) {
                console.error( "Stripe Utility Error - failed to retrieve the coupon: ", couponId, err );
                reject( err );
            }
            else {
                console.log( "Stripe Utility Successfully retrieved the Coupon: ", couponId, result );
                resolve( result );
            }
        });
    }.bind(this));
};

StripeUtil.prototype.chargeInvoice = function(customerId){
    return when.promise(function(resolve, reject){
        this.stripe.invoices.create({
            customer: customerId
        }, function(err, invoice){
            if( err ) {
                if( err.message === "Nothing to invoice for customer" ){
                    console.log("Stripe Utility No Invoice: ", err.message);
                    resolve();
                    return;
                }
                console.error( "Stripe Utility Error - failed to create invoice: ", customerId, err);
                reject(err);
            }
            else {
                var invoiceId = invoice.id;
                this.stripe.invoices.pay(invoiceId, function(err, invoice){
                    if( err ) {
                        console.error( "Stripe Utility Error - failed to pay invoice: ", invoiceId, err);
                        reject(err);
                    } else{
                        console.log( "Stripe Utility Successfully paid Invoice: ", invoiceId, invoice);
                        resolve(invoice);
                    }
                });
            }
        }.bind(this))
    }.bind(this));
};
