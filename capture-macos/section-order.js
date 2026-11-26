const order = ['account_info', 'posts', 'messages', 'timeline', 'friends', 'followers', 'following'];

function orderedPlan(plan, sections) {
  const rank = step => {
    const name = sections.find(section => section.id === step.sectionId)?.sectionName;
    const index = order.indexOf(name);
    return index < 0 ? order.length : index;
  };
  return [...plan].sort((a, b) => rank(a) - rank(b));
}

module.exports = orderedPlan;
