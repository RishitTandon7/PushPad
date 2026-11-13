// Card effects: add four edge elements to every card so CSS can trace its border on hover.
export function decorateCards(root = document) {
  root.querySelectorAll('.card').forEach((card) => {
    if (card.dataset.fx) return;
    card.dataset.fx = '1';
    ['t', 'r', 'b', 'l'].forEach((side) => {
      const edge = document.createElement('i');
      edge.className = 'tr ' + side;
      edge.setAttribute('aria-hidden', 'true');
      card.append(edge);
    });
  });
}

export function initCardFx() { decorateCards(); }
