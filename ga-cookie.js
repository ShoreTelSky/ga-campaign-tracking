/* ========================================================================
 * gaCookie by Michael Freeman (@spanishgringo) & Ben Word (@retlehs)
 * https://github.com/ShoreTelSky/ga-campaign-tracking
 * ========================================================================
 * Copyright (c) ShoreTel
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Various components originally based on the following:
 *
 * http://adamv.com/dev/javascript/querystring
 * https://code.google.com/p/ga-vki-cookies/source/browse/trunk/gaVKICookies.js?r=18
 * http://cutroni.com/blog/2007/10/29/integrating-google-analytics-with-a-crm/
 * ======================================================================== */


var gaCookie = gaCookie || {};

// This helps distinguish items in your CRM that come from the web instead of other sources.
// For example, your CRM may already have existin lead sources called "organic" or "referral"
// so this prefix will help you distinguish between "referral" (such as a client referral) and
// "WEB-referral" (someone who came to your site via a NYT.com article) in your CRM.
gaCookie.prefix = gaCookie.prefix || 'WEB-';

// Since cookies from GA are by default set at the subdomain level, but can be modfied to
// work at the full domain or even no-domain level.
// Allows for overwride and defaults if not to current hostname
gaCookie.domainName = this.domainName || document.location.hostname;

gaCookie.getDomainHash = function(strDomainName) {
  fromGaJs_h = function(e) {
    return undefined === e || "-" === e || "" === e;
  };
  fromGaJs_s = function(e) {
    var k = 1, a = 0, j, i;
    if (!fromGaJs_h(e)) {
      k = 0;
      for (j = e.length - 1; j >= 0; j--) {
        i = e.charCodeAt(j);
        k = (k << 6 & 268435455) + i + (i << 14);
        a = k & 266338304;
        k = a !== 0 ? k ^ a >> 21 : k;
      }
    }
    return k;
  };
  return fromGaJs_s(strDomainName);
};

// This is called automatically by getVisitData. Only call this if you want to load each field manually.
// This should not be run until you have already loaded GA and run the normal _trackPageview call to
// ensure that it is using the most recent source/session data

// `intGoogDomainHash` if already defined, used, but normally this will be empty
// `strCookies` use this to set the path of the cookie. 99.9% of the time you should leave this empty
// `strDefaultDomainName` this has a fallback and you should set from the value you set as gaCookie.domainName. Default value is to use the host subdomain
// `strPrefix` this is automatic and will use whatever you setup as the default prefix to appear prepended to the medium value such as WEB-cpc, WEB-referral
gaCookie.readGACookies = function(intGoogDomainHash, strCookies, strDefaultDomainName, strPrefix) {
  gaCookie.params = {};
  gaCookie.cookiesStr = strCookies;

try {
  // Check if Landing Page is already set and call it if not
  if (typeof gaCookie.landingPage == 'undefined') {
    gaCookie.checkLP();
  }
} catch(e) {

}
  // Cycle through each parameter and use default or use override if already set in gaCookie
  if (intGoogDomainHash === null) {
    intGoogDomainHash = gaCookie.getDomainHash(gaCookie.getCookie('DomainName', document.location.hostname));
  }
  if (strPrefix) {
    gaCookie.prefix = strPrefix;
  }
  if (strDefaultDomainName) {
    gaCookie.strDefaultDomainName = strDefaultDomainName;
  }
  if (gaCookie.cookiesStr == null) {
    gaCookie.cookiesStr = document.cookie;
  }
  if (gaCookie.cookiesStr.length === 0) {
    return;
  }

  // Extract only those cookies for this domain
  // RegEx Pattern to find the __utm cookies only for the right domain hash used by GA
  var rePattern = new RegExp('(__utm[a-z]{1,2}=[0-9]+[^;]*)', "g");
  // Create an array of the _utm cookies to rebuild the cookie string for later value extraction
  var matchedCookies = gaCookie.cookiesStr.match(rePattern, "$1");
  if (matchedCookies) {
    gaCookie.cookiesStr = matchedCookies.join(';');
  } else {
    gaCookie.cookiesStr = '';
    return;
  }
  // Split up campaign cookie (_utmz) into individual name=value pairs
  gaCookie.cookiesStr = gaCookie.cookiesStr.replace(/(\.|\|)utm/g, ';utm');
  // Every name/value pair is separated by a ";"
  var args = gaCookie.cookiesStr.split(';');
  // Create the individual name=value pairs
  var i,l;
  l = args.length;
  for (i = 0; i < l; i++) {
    var pair = args[i].match(/([^=]*)=(.*)/);
    // Don't use: pair = args[i].split('=') since value could contain a 2nd =
    var name = decodeURIComponent(pair[1]);
    name = name.replace(/^\s+|\s+$/g, '');
    var value = (pair.length >= 2) ? decodeURIComponent(pair[2]) : '';
    // In case page has access to > 1 domain that has __utm* cookies, we need to ensure we look only at the
    // cookies for the tracked (sub-)domain set by the Google domain hash.
    gaCookie.params[name] = value;
    var subValues = value.split('.');

    // See http://www.seotakeaways.com/google-analytics-cookies-ultimate-guide/ for a thorough GA cookie reference guide
    switch (name) {
      case '__utma':
        // domainhash.anonymizedVisitorID.ftime.ltime.stime.sessioncount
        gaCookie.params.domainhash = subValues[0];
        gaCookie.params.visitorId = subValues[1];
        gaCookie.params.ftime = subValues[2];
        gaCookie.params.ltime = subValues[3];
        gaCookie.params.stime = subValues[4];
        gaCookie.params.sessioncount = subValues[5];
        break;
      case '__utmb':
        // eg .45.10.1218592192
        gaCookie.params.gif_hits = subValues[1];
        break;
        // Custom variables which we will later parse out
      case '__utmv':
        gaCookie.params.custom = subValues[1];
        break;
      case '__utmz':
        // Number of session visits from this visitor and number of different campaigns associated with this visitor
        gaCookie.params.numSessions = subValues[2];
        gaCookie.params.numCampaigns = subValues[3];
        break;
      case 'utmcsr':
        // Campaign/source information
        if (subValues.length > 1) {
          gaCookie.params.trafficsource = '';
          for ( subValIdx = 0; subValIdx < subValues.length; subValIdx++) {
            if (subValIdx > 0) {
              gaCookie.params.trafficsource += '.';
            }
            gaCookie.params.trafficsource += subValues[subValIdx];
          }
        } else {
          gaCookie.params.trafficsource = subValues[0];
        }
    break;
      case 'utmccn':
        gaCookie.params.campaignname = subValues[0];
        break;
      case 'utmcmd':
        gaCookie.params.campaignmedium = subValues[0];
        break;
      case 'utmctr':
        gaCookie.params.campaignterm = subValues[0];
        break;
      case 'utmcct':
        gaCookie.params.campaigncontent = subValues[0];
        break;
      case 'utmcid':
        gaCookie.params.campaignid = subValues[0];
        break;
    }
  }
};

// This function takes the GA cookie values and inserts them into your form's hidden input fields
// It makes assumptions that you have hidden input fields already created in your forms and that the system that receives the submitted data can accept these values
// Make sure your Marketing Software or CRM can receive these values in the subimtted form data. However, make sure that these are all optional fields for form submission because these fields will not always be populated.
// For example, if a user blocks javascript or cookies, then your form's hidden fields will be empty.
// I recommend you name your fields as listed below. Otherwise, update the code to match the name of your hidden form fields

// gaLandingPage
// gaSource
// gaCamMed
// gaCamName
// gaCamKW
// gaCamContent

// You will notice that depending on the medium's value, not all fields are submitted
gaCookie.getVisitData = function() {
  gaCookie.readGACookies(gaCookie.domainName ? gaCookie.domainName : null);
  // Add values to form
  // Store the landing page from the session
  jQuery('input[name="gaLandingPage"]').val(gaCookie.landingPage);
  // Store the GA cookie Data
  switch (gaCookie.params.campaignmedium) {
    case 'organic':
      jQuery('input[name="gaSource"]').val(gaCookie.params.trafficsource);
      jQuery('input[name="gaCamMed"]').val(gaCookie.prefix + 'organic');
      jQuery('input[name="gaCamName"]').val('(organic)');
      jQuery('input[name="gaCamKW"]').val(gaCookie.params.campaignterm);
      break;
    case '(none)':
      // Direct visits
      jQuery('input[name="gaSource"]').val('(direct)');
      jQuery('input[name="gaCamMed"]').val(gaCookie.prefix + '(none)');
      jQuery('input[name="gaCamName"]').val('(direct)');
      break;
    case 'referral':
      jQuery('input[name="gaSource"]').val(gaCookie.params.trafficsource);
      jQuery('input[name="gaCamMed"]').val(gaCookie.prefix + 'referral');
      jQuery('input[name="gaCamName"]').val('(referral)');
      jQuery('input[name="gaCamContent"]').val(gaCookie.params.campaigncontent);
      break;
    case '(not set)':
      if (gaCookie.params.utmgclid) {
        // GA Adwords since it has gclid
        jQuery('input[name="gaCamMed"]').val(gaCookie.prefix + 'cpc');
        // These may need to be fixed because it depends on gclid on the backend
        jQuery('input[name="gaSource"]').val(gaCookie.params.trafficsource);
        jQuery('input[name="gaCamName"]').val(gaCookie.params.campaignname);
        jQuery('input[name="gaCamKW"]').val(gaCookie.params.campaignterm);
        jQuery('input[name="gaCamContent"]').val(gaCookie.params.campaigncontent);
        jQuery('input[name="gaAdWordsID"]').val(gaCookie.params.utmgclid);
      } else {
        jQuery('input[name="gaSource"]').val(gaCookie.params.trafficsource);
        jQuery('input[name="gaCamMed"]').val(gaCookie.prefix + gaCookie.params.campaignmedium);
        jQuery('input[name="gaCamName"]').val(gaCookie.params.campaignname);
        jQuery('input[name="gaCamKW"]').val(gaCookie.params.campaignterm);
        jQuery('input[name="gaCamContent"]').val(gaCookie.params.campaigncontent);
      }
      break;
      case undefined:
        // Referrer is same as host so referrer can't be source or there is no referrer
        if (document.referrer === "" || document.referrer.match(/\/\/(.+)\//)[1]==document.location.hostname) {
          jQuery('input[name="gaSource"]').val("(not set)");
        } else {
          jQuery('input[name="gaSource"]').val(document.referrer.match(/\/\/(.+)\//)[1]);
        }
        jQuery('input[name="gaCamMed"]').val(gaCookie.prefix + 'unknown');
        jQuery('input[name="gaCamName"]').val('(not set)');
      break;
    default:
      // Assume it is a custom campaign and try to include everything
      if (gaCookie.params.utmgclid) {
        // GA Adwords since it has gclid
        jQuery('input[name="gaCamMed"]').val(gaCookie.prefix + 'cpc');
        // These may need to be fixed because it depends on gclid on the backend
        jQuery('input[name="gaSource"]').val(gaCookie.params.trafficsource);
        jQuery('input[name="gaCamName"]').val(gaCookie.params.campaignname);
        jQuery('input[name="gaCamKW"]').val(gaCookie.params.campaignterm);
        jQuery('input[name="gaCamContent"]').val(gaCookie.params.campaigncontent);
        jQuery('input[name="gaAdWordsID"]').val(gaCookie.params.utmgclid);
      } else {
        jQuery('input[name="gaSource"]').val(gaCookie.params.trafficsource);
        jQuery('input[name="gaCamMed"]').val(gaCookie.prefix + gaCookie.params.campaignmedium);
        jQuery('input[name="gaCamName"]').val(gaCookie.params.campaignname);
        jQuery('input[name="gaCamKW"]').val(gaCookie.params.campaignterm);
        jQuery('input[name="gaCamContent"]').val(gaCookie.params.campaigncontent);
      }
  }
};

// Helper functions to place less used session time and count data in your hidden form fields
// Most MAP already track this info well and in a way fairly consistently with GA so they often are not necessary
gaCookie.getFirstVisitTime = function(firstVisitFieldName) {
  if (typeof gaCookie.params.ftime == 'undefined') {
    gaCookie.readGACookies(gaCookie.domainName ? gaCookie.domainName : null);
  }
  jQuery('input[name="'+ firstVisitFieldName +'"]').val(gaCookie.params.ftime);
};

gaCookie.getLastVisitTime = function(lastVisitFieldName) {
  if (typeof gaCookie.params.ltime == 'undefined') {
    gaCookie.readGACookies(gaCookie.domainName ? gaCookie.domainName : null);
  }
  jQuery('input[name="'+ lastVisitFieldName +'"]').val(gaCookie.params.ltime);
};

gaCookie.getSessionStartTime = function(sessionVisitTimeFieldName) {
  if (typeof gaCookie.params.stime == 'undefined') {
    gaCookie.readGACookies(gaCookie.domainName ? gaCookie.domainName : null);
  }
  jQuery('input[name="'+ sessionVisitTimeFieldName +'"]').val(gaCookie.params.stime);
};

gaCookie.getSessionVisits = function(sessionVisitsFieldName) {
  if (typeof gaCookie.params.numSessions == 'undefined') {
    gaCookie.readGACookies(gaCookie.domainName ? gaCookie.domainName : null);
  }
  jQuery('input[name="'+ sessionVisitsFieldName +'"]').val(gaCookie.params.numSessions);
};

gaCookie.getNumberCampaigns = function(numberCampaignsFieldName) {
if (typeof gaCookie.params.numCampaigns == 'undefined') {
    gaCookie.readGACookies(gaCookie.domainName ? gaCookie.domainName : null);
  }
  jQuery('input[name="'+ numberCampaignsFieldName +'"]').val(gaCookie.params.numCampaigns);
};

gaCookie.getGAVisitorID = function(gaVisitorIDFieldName){
if (typeof gaCookie.params.visitorId == 'undefined') {
    gaCookie.readGACookies(gaCookie.domainName ? gaCookie.domainName : null);
  }
  jQuery('input[name="'+ gaVisitorIDFieldName +'"]').val(gaCookie.params.visitorId);
};

// TODO: parse out Custom Variable values
// Custom variables are not always persisted in the GA cookie. It depends on the custom variable's scope. The custom variable is accessible if it
// is a session-level scoped custom variable.  Page-level scoe custom variables only appear during the page view where the custom variable was set. Visitor level custom variables are set one time and then tracked via the visitorID on the backend
gaCookie.getSessionVisits = function(customVarNum, customVarFieldName) {
  if (typeof gaCookie.params.visitorId == 'undefined') {
    gaCookie.readGACookies(gaCookie.domainName ? gaCookie.domainName : null);
  }
  var custVarVal;
  try {
   custVarVal = gaCookie.params.custom;
  } catch(e) {
    custVarVal = '';
  }
  jQuery('input[name="'+ customVarFieldName +'"]').val(custVarVal);
};

// Utility Functions for getting, setting, testing, and deleting cookies
gaCookie.get = function(key, default_) {
  var value = this.params[key];
  return (value !== null) ? value : default_;
};

gaCookie.set = function(strCookieName, value, strDomainName, strPath, hours) {
  this.writeCookie(strCookieName, value, strDomainName, strPath, hours);
};

gaCookie.contains = function(key) {
  var value = this.params[key];
  return (value !== null);
};

gaCookie.formatDateTime = function(strSession) {
  var value = this.params[strSession];
  var d = new Date(value * 1000);

  var strDate = d.toLocaleDateString();
  strDate = strDate.replace(/[a-z]{3}.*[, ]+([a-z]{3})[^, ]*/i, '$1');
  strDate += ' ' + d.toLocaleTimeString();
  return strDate;
};

gaCookie.getCookie = function(strCookieName, strDefault) {
  var strCookieValue;
  try {
    strCookieValue = document.cookie.match(strCookieName + '=' + '(([^;])*)')[1];
  } catch(e) {
    strCookieValue = strDefault;
  }
  return strCookieValue;
};

gaCookie.deleteCookie = function(strCookieName, strDomainName, strPath) {
  this.writeCookie(strCookieName, '', strDomainName, strPath, -1);
};

gaCookie.deleteAllCookies = function(strDomainName) {
  var new_date = new Date();
  var aryCookie;
  new_date.setTime(1);
  new_date = new_date.toGMTString();

  var thecookie = document.cookie.split(';');
  for (var i = 0; i < thecookie.length; i++) {
    aryCookie = thecookie[i].split('=');
    deleteCookie(aryCookie[0], strDomainName, '');
  }
};

gaCookie.writeCookie = function(strCookieName, value, strDomainName, strPath, hours) {
  var d = new Date();
  strDomainName = strDomainName || this.strDefaultDomainName;
  d.setTime(d.getTime() + (hours * 60 * 60 * 1000));
  var strExpiry = (hours === 0) ? 0 : d.toGMTString();
  var strCookie = strCookieName + '=' + value + ';expires=' + strExpiry + ';path=' + strPath + ';domain=' + strDomainName;
  document.cookie = strCookie;
};

// Function for storing and retrieving session landing page in a 1st party cookie. Since the GA cookie does not track the landing page you need to do this outside of the GA cookie
// But this value is accessed via the gaCookie object by calling gaCookie.landingPage
// This function should be called as part of your onReady or onLoad events in the webpage.  For example include this in
// $().ready(function({
// if you use top domain level GA tracking, uncomment the line below. replace yoursite.com with your website's domain
//  gaCookie.domainName = "yoursite.com" ;
// if you want no prefix appended to your medium and lead source fields such as "WEB-" then uncomment the below line and leave as is. If you want to change it, uncomment and add your own prefix
//  gaCookie.prefix = "";
//    gaCookie.checkLP();
// });
gaCookie.checkLP = function() {
  try {
    var cVarPos = document.cookie.search('gaCVarLP');
    if (cVarPos > -1) {
        gaCookie.landingPage = gaCookie.getCookie('gaCVarLP', '');
    } else {
      var lp = document.location.pathname;
      lp = lp.length > 124 ? lp.substr(lp.length - 124,124) : lp;
      gaCookie.set('gaCVarLP', lp, this.domainName, '/', 0.5);
      gaCookie.landingPage =lp;
    }
  } catch(e) { }
};

/* ========================================================================
 * Copyright (c) 2008, Adam Vandenberg
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *     * Redistributions of source code must retain the above copyright notice,
 *       this list of conditions and the following disclaimer.
 *
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 * ======================================================================== */