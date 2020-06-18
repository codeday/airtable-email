require('dotenv').config();
const { base, fetchAll } = require('./airtable');
const postmark = require('postmark');
const inquirer = require('inquirer');
const Handlebars = require('handlebars');
const { markdown } = require('markdown');
var client = new postmark.Client(process.env.POSTMARK_KEY);

const renderEmail = (to, subject, template) => {
  const subjectRendered = Handlebars.compile(subject)(to);
  const templateRendered = template(to);
  const html = markdown.toHTML(templateRendered);

  return {
    To: to._emailTo,
    From: process.env.POSTMARK_FROM,
    Subject: subjectRendered,
    TextBody: templateRendered,
    HtmlBody: html,
  };
}

(async () => {
  let records = [];
  let confirm = false;
  while (!confirm) {
    console.log();
    const { table, filter, nameField, emailField } = await inquirer.prompt([
      {
        type: 'input',
        name: 'table',
        message: `Table name?`
      },
      {
        type: 'input',
        name: 'filter',
        message: `Filter string?`
      },
      {
        type: 'input',
        name: 'nameField',
        message: 'Name field?',
        default: 'Name',
      },
      {
        type: 'input',
        name: 'emailField',
        message: 'Email field?',
        default: 'Email',
      }
    ]);

    try {
      records = await fetchAll(base(table).select({ filterByFormula: filter }));
      records = records
      .filter((r) => r && r.fields)
      .map((r) => ({ _emailTo: `"${r.fields[nameField]}" <${r.fields[emailField]}>`, id: r.id, ...r.fields }));
      console.log(
        `Retrieved records include ${records.slice(0,3).map((r) => r[nameField]).join(', ')},`
        + ` and ${Math.max(0, records.length - 3)} others.`
      );
      console.log();
      confirm = (await inquirer.prompt([{ type: 'confirm', name: 'confirm', message: 'Look right?' }])).confirm;
    } catch (err) { console.error(err); }
  }

  confirm = false;
  let subject, templateSrc, template;

  while (!confirm) {
    console.log();
    ({ subject, templateSrc } = await inquirer.prompt([
      {
        type: 'input',
        name: 'subject',
        message: 'Subject?',
      },
      {
        type: 'editor',
        name: 'templateSrc',
        message: 'Email message template (md, handlebars)?'
      },
    ]));
    try {
      template = Handlebars.compile(templateSrc);

      const preview = renderEmail(records[0], subject, template);
      console.log(`--- Email Preview ---`);
      console.log(`From: ${preview.From}`);
      console.log(`To: ${preview.To}`);
      console.log(`Subject: ${preview.Subject}`);
      console.log(``);
      console.log(preview.HtmlBody);
      console.log(`---------------------`);
      console.log();
      confirm = (await inquirer.prompt([{ type: 'confirm', name: 'confirm', message: 'Look right?' }])).confirm;
    } catch (ex) { console.error(err); }
  }


  for (let record of records) {
    console.log(`Sending to ${record._emailTo}`);
    const email = renderEmail(record, subject, template);
    await client.sendEmail(email);
  }
})();
