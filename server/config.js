/* Konfiguracja SERWERA panelu (nie mylić z js/config.js, który jest konfiguracją strony).
   Zmiany wymagają restartu serwera. Role (ID) i właścicieli można później edytować z poziomu panelu
   (moduł „Role i uprawnienia”) – zapisują się wtedy w data/access.json i nadpisują wartości stąd.
   ID kopiujesz z Discorda: Ustawienia > Zaawansowane > Tryb dewelopera, potem PPM na rolę/serwer/użytkownika > Kopiuj ID. */
module.exports = {
  guildId: '1556393189659779184',

  /* Właściciele: dostają WSZYSTKIE uprawnienia niezależnie od ról (ID użytkowników Discord).
     Tylko właściciele mogą edytować role i właścicieli w panelu – wpisz tu na start swoje ID. */
  owners: [
     '618689685253914624'
  ],

  /* nazwa -> ID roli na Discordzie (docelowo każda rola powinna mieć swoje ID) */
  roles: {
    zarzad: '1566945694592532480',

    admin: '1566945773768413326',

    moderator: '1566945830965870632',

    obywatel: '1558940483642982451',
  },

  /* uprawnienie -> które role (nazwy z listy wyżej) je dają.
     Uprawnienie "roles.edit" (edycja ról i właścicieli) jest zawsze tylko dla właścicieli – nie da się go nadać rolom. */
  permissions: {
    'panel.access':   ['zarzad', 'admin', 'moderator', 'obywatel'],
    'roles.view':     ['zarzad', 'admin'],
    'logs.view':      ['zarzad', 'admin'],
    'regulamin.edit': ['zarzad', 'admin'],
    'gracze.view':    ['zarzad', 'admin', 'moderator', 'obywatel'],
    'postacie.view': ['obywatel'],
    /* podania.review = rozpatruje WSZYSTKIE podania. Rozpatrywanie pojedynczego formularza (np. opiekun administracji, zarząd LSPD)
       ustawiasz w panelu: Podania > Formularze i role > „Role rozpatrujące” – bez zmian w tym pliku. */
    'podania.review': ['zarzad'],
    /* podania.manage = tworzenie podań, edycja pytań i ról rozpatrujących w panelu */
    'podania.manage': ['zarzad', 'admin']
  },

  /* Podania: domyślny kanał, na który bot wrzuca decyzje (można go nadpisać osobno dla każdego formularza w panelu).
     Puste = tylko wiadomość prywatna. Bot musi mieć na tym kanale uprawnienia „Wyświetlanie kanału” i „Wysyłanie wiadomości”. */
  applications: { decisionChannelId: '1558940779164999730' },

  /* moduły widoczne w panelu (id: overview / roles / logs / regulamin / gracze mają gotowe widoki).
     Moduł pokazuje się tylko osobom z uprawnieniem "perm". Dodanie  soon: true  zamienia go z powrotem w "wkrótce". */
  modules: [
    { id: 'overview',  title: 'Przegląd',           ikona: 'shield', kolor: 'teal',   perm: 'panel.access',   opis: '' },
    { id: 'roles',     title: 'Uprawnienia', ikona: 'scale',  kolor: 'amber',  perm: 'roles.view',     opis: '' },
    { id: 'logs',      title: 'Logi',        ikona: 'scroll', kolor: 'coral',  perm: 'logs.view',      opis: '' },
    { id: 'regulamin', title: 'Regulaminy',  ikona: 'scroll', kolor: 'violet', perm: 'regulamin.edit', opis: '' },
    { id: 'gracze',    title: 'Gracze',             ikona: 'city',   kolor: 'mint',   perm: 'gracze.view',    opis: '' },
    { id: 'podania',   title: 'Podania',            ikona: 'scroll', kolor: 'coral',  perm: 'podania.access', opis: '' }
  ]
};