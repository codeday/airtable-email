const Airtable = require('airtable');

module.exports.baseId = process.env.AIRTABLE_BASE;
module.exports.base = new Airtable({ apiKey: process.env.AIRTABLE_KEY }).base(module.exports.baseId);
module.exports.fetchAll = async (select) => {
  let allRecords = [];

  await select.eachPage((records, fetchNextPage) => {
    allRecords = [...allRecords, ...records];
    fetchNextPage();
  });

  return allRecords;
};
