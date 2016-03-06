var App = angular.module('App', ['localytics.directives', 'hc.marked']);

var COOKIE_TIMEOUT_MS = 900000;
var STORAGE_KEY = 'LUCYBOT_RECIPE_CREDS';

App.controller('Body', function($scope) {
  $scope.user = {};
  $scope.pathname = window.location.pathname;
  $scope.setUser = function(creds) {
    $scope.user = creds;
    var now = new Date();
    var expires = new Date(now.getTime() + COOKIE_TIMEOUT_MS);
    var cookie = STORAGE_KEY + '=' + JSON.stringify(creds) + '; expires=' + expires.toUTCString() + '; Path=/';
    document.cookie = cookie;
  }

  var cookies = document.cookie.split(';').map(function(c) {return c.trim()});
  var credCookie = cookies.filter(function(c) {
    return c.indexOf(STORAGE_KEY) === 0;
  })[0];
  if (credCookie) {
    var stored = credCookie.substring(STORAGE_KEY.length + 1);
    $scope.user = JSON.parse(stored);
  }

  $scope.openRecipe = function(name) {
    if ($scope.user.userId) {
      window.location.href = '/recipes/' + name;
    } else {
      $('#Signup').modal('show');
    }
  }
})

App.controller('Login', function($scope) {
  $scope.responses = {};
  $scope.loginInputs = [
    {label: 'E-mail', model:"email", type:"email", required: true},
    {label: 'Password', model:"password", type:"password", required: true},
  ];

  $scope.partnerInputs = [
    {label: 'Partner ID', model: "partnerId", type: "select", required: true},
  ]

  $scope.inputs = $scope.loginInputs;

  $scope.submit = function() {
    $scope.alert = {};
    $scope.loading = true;
    if ($scope.inputs === $scope.loginInputs) {
      $scope.login();
    } else {
      $scope.selectPartner();
    }
  }

  $scope.selectPartner = function() {
    $.ajax({
      url: '/auth/selectPartner',
      method: 'POST',
      data: JSON.stringify($scope.responses),
      headers: {'Content-Type': 'application/json'},
    })
    .done(function(data) {
      var creds = {
        secret: data.adminSecret,
        userId: $scope.responses.email,
        partnerId: $scope.responses.partnerId,
      }
      $scope.setUser(creds);
      $scope.alert = {success: "You're ready to go!"};
      setTimeout(function() {
        $scope.alert = {};
        $('#Login').modal('hide');
      }, 1500);
    })
    .fail(function(xhr) {
      mixpanel.track('login_error', {
        partnerId: $scope.responses.partnerId,
        email: $scope.responses.email,
        error: xhr.responseText,
      })
      $scope.alert = {danger: "Error logging in: " + xhr.responseText}
    })
    .always(function() {
      $scope.$apply()
      $scope.loading = false;
    })
  }

  $scope.login = function() {
    mixpanel.track('login_submit', {
      partnerId: $scope.responses.partnerId,
      email: $scope.responses.email,
    });
    $.ajax({
      url: '/auth/login',
      method: 'POST',
      data: JSON.stringify($scope.responses),
      headers: {'Content-Type': 'application/json'},
    })
    .done(function(response) {
      mixpanel.identify($scope.responses.email);
      mixpanel.people.set({
        '$email': $scope.responses.email,
        partnerId: $scope.responses.partnerId,
      })
      mixpanel.track('login_success', {
        partnerId: $scope.responses.partnerId,
        email: $scope.responses.email,
      })
      $scope.responses.adminSecret = response.adminSecret;
      $scope.alert = {info: "Choose the Kaltura account you'd like to use"};
      $scope.partnerInputs[0].options = response.map(function(partner) {
        return {label: partner.name + ' (' + partner.id + ')', value: partner.id}
      })
      $scope.inputs = $scope.partnerInputs;
      $scope.responses.partnerId = $scope.partnerInputs[0].options[0].value;
    })
    .fail(function(xhr) {
      mixpanel.track('login_error', {
        partnerId: $scope.responses.partnerId,
        email: $scope.responses.email,
        error: xhr.responseText,
      })
      $scope.alert = {danger: "Error logging in: " + xhr.responseText}
    })
    .always(function() {
      $scope.loading = false;
      $scope.$apply();
    })
  }
});

App.controller('Signup', function($scope) {
  $scope.responses = {};
  $scope.alert = {};
  $scope.inputs = [
    {label: 'First name', model: 'firstName', type: 'text', required: true},
    {label: 'Last name', model: 'lastName', type: 'text', required: true},
    {label: 'Company', model: 'company', type: 'text', required: true},
    {label: 'E-mail', model:'email', type:'email', required: true},
    {label: 'Country', model:'country', type: 'select', options: COUNTRIES, required: true},
    {label: 'State', model: 'state', type: 'select', hidden: true},
    {label: 'How are you planning to use Kaltura?', model: 'usage', type: 'textarea'},
    {label: 'Would you like a Kaltura expert to help architect/design a solution with you?',
     model: 'help', type: 'radio', options: [{label: 'Yes', value: true}, {label: 'No', value: false}]}
  ];

  $scope.$watch('responses.country', function() {
    var states = STATES[$scope.responses.country];
    if (states) {
      $scope.inputs[5].hidden = false;
      $scope.inputs[5].options = states;
    } else {
      $scope.responses.state = null;
      $scope.inputs[5].hidden = true;
    }
  });

  $scope.submit = function() {
    $scope.alert = {};
    $scope.loading = true;
    mixpanel.track('signup_submit', $scope.responses);
    $.ajax({
      url: '/auth/signup',
      method: 'POST',
      data: JSON.stringify($scope.responses),
      headers: {'Content-Type': 'application/json'},
    })
    .done(function(response) {
      mixpanel.identify($scope.responses.email);
      mixpanel.people.set({
        '$email': $scope.responses.email,
        partnerId: response.id,
        country: $scope.responses.country,
        state: $scope.responses.state,
        company: $scope.responses.company,
        firstName: $scope.responses.firstName,
        lastName: $scope.responses.lastName,
      })
      mixpanel.track('signup_success', {
        partnerId: response.id,
        email: $scope.responses.email,
      })
      var creds = {
        partnerId: response.id,
        userId: response.adminUserId,
        secret: response.adminSecret,
      }
      $scope.setUser(creds);
      $scope.alert = {success: "You're ready to go!"};
      setTimeout(function() {
        $scope.alert = {};
        $('#Signup').modal('hide');
      }, 1500);
    })
    .fail(function(xhr) {
      $scope.responses.error = xhr.responseText;
      mixpanel.track('signup_error', $scope.responses);
      $scope.alert = {danger: "Error creating account: " + xhr.responseText}
    })
    .always(function() {
      mixpanel.track('signup_success', $scope.responses);
      $scope.loading = false;
      $scope.$apply();
    })
  }
});

$(document).ready(function() {
  $('#Signup').on('shown.bs.modal', function() {
    mixpanel.track('signup_start');
  });
  $('#Login').on('shown.bs.modal', function() {
    mixpanel.track('login_start');
  })
})
