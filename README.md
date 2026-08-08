# canutillocs.com

Public site for Fundamentals of Computer Science at Canutillo High School:
family newsletters (**The Loop**) in English and Spanish, the welcome letter,
and a few browser-based classroom tools.

Served by **GitHub Pages** from the `main` branch root → https://canutillocs.com

## Structure

```
/                          landing page
/welcome/                  welcome letter, EN + ES
/newsletters/              newsletter archive, newest first
/newsletters/YYYY-MM-issue-NN/
        index.html         online version, EN + ES
        the-loop-issue-NN.pdf   print version
        img/               images for that issue
/teacher-tools/            browser-only classroom tools
/assets/                   shared CSS, logos
```

Static HTML, CSS, and JavaScript — no build step, no backend, no analytics.
The teacher tools run entirely in the browser; anything entered into them stays
in that browser's local storage.

## Adding a newsletter issue

1. Copy the most recent `newsletters/YYYY-MM-issue-NN/` folder to a new one.
2. Replace its images and PDF; edit the `index.html` — every section has a
   paired English and Spanish block, so update both.
3. Add a card to `/newsletters/index.html` and update the latest-issue card on
   `/index.html`.
4. Check it at phone width before pushing.

— Mark Johnston, Room H120
