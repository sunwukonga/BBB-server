import casual from 'casual';

const mocks = {
  String: () => 'It works!',
  Query: () => ({
    user: (root, args) => {
      return { firstName: args.firstName, lastName: args.lastName };
    },
  }),
  User: () => ({ firstName: () => casual.first_name, lastName: () => casual.last_name }),
  Listing: () => ({ title: casual.title, description: casual.sentences(3) }),
};

export default mocks;
