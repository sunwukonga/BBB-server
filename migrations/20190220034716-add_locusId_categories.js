'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'categories'
    , 'locusId'
    , {
        type: Sequelize.INTEGER
      , allowNull: true
      }
    )
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'categories'
    , 'locusId'
    )
  }
};
