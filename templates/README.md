# Templates & Modular CSS Directory

This directory provides clean, modular, production-ready templates and isolated CSS stylesheets that reproduce the exact website design and layout reference.

---

## 📁 Directory Structure

```
NLP_Project/
├── css/                                  # Pure CSS stylesheets matching the reference layout
│   ├── variables.css                     # Design tokens & Light/Dark theme CSS custom properties
│   ├── layout.css                        # App grid, header, main wrapper & mobile responsive breakpoints
│   ├── sidebar.css                       # Collapsible sidebar, new chat, navigation & chat history list
│   ├── cards.css                         # Hero section & the 3 suggestion cards
│   ├── tasks.css                         # "My Tasks" board, search, add task & prioritize button
│   ├── chat.css                          # Message bubbles, typing dots & floating bottom prompt input
│   ├── components.css                    # Reusable buttons, inputs, modals & profile dropdown
│   └── style.css                         # Master stylesheet bundling all modular CSS files
│
└── templates/                            # Pure templates for each screen and UI component
    ├── index.html                        # Standalone interactive HTML demo with exact reference UI
    ├── HomeScreen.template.js            # Home dashboard template
    ├── Sidebar.template.js               # Collapsible sidebar & mobile drawer template
    ├── Header.template.js                # Top header bar template with theme switcher
    ├── ChatArea.template.js              # Chat thread and floating prompt bar template
    ├── SuggestedCards.template.js        # The 3 action suggestion cards template
    ├── TaskManager.template.js           # "My Tasks" board template
    └── LoginScreen.template.js           # Authentication screen template
```

---

## 🎨 Using the Modular CSS

You can link the entire master stylesheet in any HTML document:
```html
<link rel="stylesheet" href="css/style.css" />
```

Or selectively import only the component stylesheets you need:
```css
@import 'css/variables.css';
@import 'css/layout.css';
@import 'css/sidebar.css';
@import 'css/cards.css';
@import 'css/tasks.css';
@import 'css/chat.css';
@import 'css/components.css';
```

---

## 🖥️ Viewing the Standalone Template

Simply open `templates/index.html` in any web browser to view the interactive dashboard with dark/light mode toggle, collapsible sidebar, suggestion cards, task management, and floating prompt bar!
