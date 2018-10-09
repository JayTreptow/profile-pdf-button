
const pdlib = require('pdfkit');

export default {
  actions: {
    clickButton() {
      console.log('in the click button')
      const url = this.siteSettings.profile_pdf_button_url.replace('<TOPIC_ID>', this.get('topic.id')).replace('<USER_ID>', this.currentUser.id).replace('<USERNAME>', this.currentUser.username);
//      window.open(url, '_blank');
    }
  }
};

