// Dynamic site configuration that handles both public and private GitHub Pages
module.exports = function() {
  // Get path prefix from environment or default to "/"
  const pathPrefix = process.env.ELEVENTY_PATH_PREFIX || "/";
  
  // Determine base URL based on deployment context
  const baseUrl = process.env.URL || "https://scotaccount.github.io/sg-identity-techdocs";
  
  return {
    title: "ScotAccount Technical Documentation",
    description: "Technical documentation for ScotAccount - Scottish Government digital identity service",
    url: baseUrl,
    pathPrefix: pathPrefix,
    author: "Scottish Government",
    language: "en-GB",
    locale: "en_GB",
    organization: {
      name: "Scottish Government",
      url: "https://www.gov.scot",
      logo: "/assets/scotgovlogo.svg"
    },
    navigation: [
      {
        text: "Home",
        url: "/",
        key: "home"
      },
      {
        text: "Getting Started",
        url: "/getting-started/",
        key: "getting-started"
      },
      {
        text: "Architecture",
        url: "/architecture/",
        key: "architecture"
      },
      {
        text: "Implementation",
        url: "/scotaccount-guide/",
        key: "implementation-guide"
      },
      {
        text: "Complete Guide",
        url: "/scotaccount-complete-guide/",
        key: "complete-guide"
      },
      {
        text: "Token Examples",
        url: "/scotaccount-token-validation-module/",
        key: "token-validation-examples"
      },
      {
        text: "Integration Examples",
        url: "/integration-examples/",
        key: "integration-examples"
      }
    ]
  };
};
