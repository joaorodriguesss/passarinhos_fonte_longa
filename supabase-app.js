const tabs = [...document.querySelectorAll('[role="tab"][data-tab]')];
const panels = [...document.querySelectorAll('[data-panel]')];
const adminPanel = document.querySelector('#painel-gestao');
const adminLoginScreen = document.querySelector('#admin-login-screen');
const adminRequested = new URLSearchParams(window.location.search).get('gestao') === '1';
const coverImage = document.querySelector('#cover-image');
const coverPlaceholder = document.querySelector('#cover-placeholder');
const brandLogo = document.querySelector('#brand-logo');
const config = window.SUPABASE_CONFIG || {};

if (coverImage) coverImage.hidden = true;
if (coverPlaceholder) coverPlaceholder.hidden = true;
if (brandLogo) brandLogo.hidden = true;
const supabaseClient = config.url && config.anonKey && window.supabase
  ? window.supabase.createClient(config.url, config.anonKey)
  : null;
const imageBucket = 'catalog-images';
let birds = [];
let facilities = [];
let birdPhotos = [];
let editingBird = null;
let isAdmin = false;
let birdPhotoTableAvailable = true;
let birdStatusColumnAvailable = true;
let birdMutationColumnAvailable = true;
let activeBirdPhotos = [];
let activeBirdPhotoIndex = 0;
let homeCoverImages = [];
let homeCoverIndex = 0;
let homeCoverTimer = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function formatPrice(price) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(price);
}

function birdStatusLabel(status) {
  return ({ available: 'Disponível', reserved: 'Reservada', sold: 'Vendida' })[status] || 'Disponível';
}

function publicImageUrl(path) {
  return supabaseClient.storage.from(imageBucket).getPublicUrl(path).data.publicUrl;
}

function setStatus(message, isError = false) {
  const status = document.querySelector('#storage-note');
  status.textContent = message;
  status.classList.toggle('is-error', isError);
}

function activateTab(name, moveFocus = false) {
  const selectedTab = tabs.find((tab) => tab.dataset.tab === name);
  if (!selectedTab) return;

  const wasAlreadyActive = selectedTab.classList.contains('is-active');

  tabs.forEach((tab) => {
    const isSelected = tab === selectedTab;
    tab.classList.toggle('is-active', isSelected);
    tab.setAttribute('aria-selected', String(isSelected));
    tab.tabIndex = isSelected ? 0 : -1;
  });
  panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== name; });
  if (moveFocus) selectedTab.focus();

  if (name === 'aves' && wasAlreadyActive) {
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindTab(tab) {
  tab.addEventListener('click', () => activateTab(tab.dataset.tab));
  tab.addEventListener('keydown', (event) => {
    let nextIndex = tabs.indexOf(tab);
    if (event.key === 'ArrowRight') nextIndex = (nextIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (nextIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    activateTab(tabs[nextIndex].dataset.tab, true);
  });
}

tabs.forEach(bindTab);

document.addEventListener('click', (event) => {
  const birdTrigger = event.target.closest('[data-open-bird]');
  if (birdTrigger) {
    event.preventDefault();
    openBirdDialog(birdTrigger.dataset.openBird);
    return;
  }
  const tabLink = event.target.closest('[data-open-tab]');
  if (!tabLink) return;
  event.preventDefault();
  activateTab(tabLink.dataset.openTab);
});

document.querySelectorAll('[data-management-tab]').forEach((tab) => {
  tab.addEventListener('click', () => {
    if (!isAdmin) return;
    if (tab.dataset.managementTab !== 'security') stopSecurityViewer();
    document.querySelectorAll('[data-management-tab]').forEach((item) => item.classList.toggle('is-active', item === tab));
    document.querySelectorAll('[data-management-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.managementPanel !== tab.dataset.managementTab;
    });
  });
});

function stopSecurityViewer() {
  const player = document.querySelector('#security-player');
  player.replaceChildren(Object.assign(document.createElement('p'), {
    textContent: 'Inicia o visualizador local para abrir a transmissão da câmara nesta área.'
  }));
  document.querySelector('#security-stream-status').textContent = 'Visualizador local desligado';
}

document.querySelector('#security-viewer-start').addEventListener('click', () => {
  if (!isAdmin) return;
  const status = document.querySelector('#security-stream-status');
  const player = document.querySelector('#security-player');
  const frame = document.createElement('iframe');
  frame.title = 'Visualizador local da câmara Mercusys';
  frame.src = 'http://127.0.0.1:3021';
  frame.allow = 'autoplay; fullscreen; picture-in-picture';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'no-referrer';
  player.replaceChildren(frame);
  status.textContent = 'A tentar ligar ao visualizador local';
  frame.addEventListener('load', () => {
    status.textContent = 'Visualizador aberto; inicia o stream nas definições do visualizador';
  }, { once: true });
});

function addManagementTab() {
  if (document.querySelector('#tab-gestao')) return;
  const tab = document.createElement('button');
  tab.className = 'nav-tab';
  tab.id = 'tab-gestao';
  tab.type = 'button';
  tab.setAttribute('role', 'tab');
  tab.setAttribute('aria-selected', 'false');
  tab.setAttribute('aria-controls', 'painel-gestao');
  tab.dataset.tab = 'gestao';
  tab.tabIndex = -1;
  tab.textContent = 'Gerir catálogo';
  document.querySelector('.main-nav').append(tab);
  tabs.push(tab);
  bindTab(tab);
}

function removeManagementTab() {
  stopSecurityViewer();
  const managementTab = document.querySelector('#tab-gestao');
  if (managementTab?.classList.contains('is-active')) activateTab('aves');
  document.querySelector('#tab-gestao')?.remove();
  const tabIndex = tabs.findIndex((tab) => tab.dataset.tab === 'gestao');
  if (tabIndex !== -1) tabs.splice(tabIndex, 1);
  adminPanel.hidden = true;
  isAdmin = false;
}

function showLoginScreen() {
  adminLoginScreen.hidden = false;
  document.querySelector('main').hidden = true;
  document.querySelector('.site-footer').hidden = true;
}

function showPublicPage() {
  adminLoginScreen.hidden = true;
  document.querySelector('main').hidden = false;
  document.querySelector('.site-footer').hidden = false;
}

async function checkAdmin(user) {
  const { data, error } = await supabaseClient
    .from('catalog_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function enableAdmin() {
  isAdmin = true;
  addManagementTab();
  showPublicPage();
  history.replaceState(null, '', window.location.pathname);
  await loadContent();
  activateTab('gestao');
}

function imagePreview(input, preview) {
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      input.value = '';
      return;
    }
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  });
}

imagePreview(document.querySelector('#bird-image'), document.querySelector('#bird-image-preview'));
imagePreview(document.querySelector('#cover-file'), document.querySelector('#cover-preview'));
imagePreview(document.querySelector('#logo-file'), document.querySelector('#logo-preview'));
imagePreview(document.querySelector('#facility-file'), document.querySelector('#facility-preview'));

function ageInMonths(age) {
  const matches = [...String(age || '').toLocaleLowerCase('pt-PT').matchAll(/(\d+(?:[.,]\d+)?)\s*(anos?|m[eê]s(?:es)?|semanas?|dias?)/g)];
  if (!matches.length) return null;
  return matches.reduce((total, match) => {
    const amount = Number(match[1].replace(',', '.'));
    const unit = match[2];
    if (unit.startsWith('ano')) return total + amount * 12;
    if (unit.startsWith('semana')) return total + amount / 4.345;
    if (unit.startsWith('dia')) return total + amount / 30.44;
    return total + amount;
  }, 0);
}

function matchesAgeRange(age, range) {
  if (!range) return true;
  const months = ageInMonths(age);
  if (range === 'unknown') return months === null;
  if (months === null) return false;
  if (range === 'up-to-6') return months <= 6;
  if (range === '6-to-12') return months > 6 && months < 12;
  if (range === '1-to-3') return months >= 12 && months <= 36;
  return months > 36;
}

function refreshFilterOptions(select, values, allLabel) {
  const previous = select.value;
  const options = [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'pt-PT'));
  select.innerHTML = `<option value="">${allLabel}</option>${options.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}`;
  if (options.includes(previous)) select.value = previous;
}

function refreshBirdFilters() {
  refreshFilterOptions(document.querySelector('#filter-species'), birds.map((bird) => bird.species), 'Todas');
  refreshFilterOptions(document.querySelector('#filter-mutation'), birds.map((bird) => bird.mutation), 'Todas');
  document.querySelector('#filter-mutation').disabled = birds.length > 0 && !Object.hasOwn(birds[0], 'mutation');
}

function getFilteredBirds() {
  const species = document.querySelector('#filter-species').value;
  const mutation = document.querySelector('#filter-mutation').value;
  const sex = document.querySelector('#filter-sex').value;
  const age = document.querySelector('#filter-age').value;
  const status = document.querySelector('#filter-status').value;
  const minPrice = document.querySelector('#filter-price-min').value;
  const maxPrice = document.querySelector('#filter-price-max').value;
  const sort = document.querySelector('#filter-sort').value;
  const filtered = birds.filter((bird) => {
    if (species && bird.species !== species) return false;
    if (mutation && (bird.mutation || '') !== mutation) return false;
    if (sex && bird.sex !== sex) return false;
    if (!matchesAgeRange(bird.age, age)) return false;
    if (status && (bird.status || 'available') !== status) return false;
    if (minPrice !== '' && Number(bird.price) < Number(minPrice)) return false;
    if (maxPrice !== '' && Number(bird.price) > Number(maxPrice)) return false;
    return true;
  });

  filtered.sort((left, right) => {
    if (sort === 'price-asc') return Number(left.price) - Number(right.price);
    if (sort === 'price-desc') return Number(right.price) - Number(left.price);
    const dateDifference = new Date(left.created_at || 0) - new Date(right.created_at || 0);
    return sort === 'oldest' ? dateDifference : -dateDifference;
  });
  return filtered;
}

function renderBirds() {
  const grid = document.querySelector('#bird-grid');
  const filteredBirds = getFilteredBirds();
  document.querySelector('#bird-count').textContent = String(filteredBirds.length).padStart(2, '0');
  const emptyState = document.querySelector('#bird-empty');
  emptyState.hidden = filteredBirds.length > 0;
  emptyState.textContent = birds.length
    ? 'Não foram encontradas aves com estes filtros.'
    : 'De momento, não existem aves disponíveis.';
  grid.innerHTML = filteredBirds.map((bird) => `
    <article class="bird-card">
      <button class="bird-image" type="button" data-open-bird="${escapeHtml(bird.id)}" aria-label="Ver fotografias e detalhes de ${escapeHtml(bird.title)}">
        <img src="${publicImageUrl(bird.image_path)}" alt="${escapeHtml(bird.title)}" loading="lazy">
        <span class="availability status-${escapeHtml(bird.status || 'available')}"><span></span>${birdStatusLabel(bird.status)}</span>
      </button>
      <div class="bird-info"><div><p class="bird-category">${escapeHtml(bird.species)}${bird.mutation ? ` · ${escapeHtml(bird.mutation)}` : ''}</p><h3>${escapeHtml(bird.title)}</h3></div>
        <button class="round-link" type="button" data-open-bird="${escapeHtml(bird.id)}" aria-label="Ver detalhes de ${escapeHtml(bird.title)}">↗</button>
      </div>
      <p class="bird-description">${escapeHtml(bird.description)}</p>
      <p class="bird-details">${escapeHtml(bird.sex)} · ${escapeHtml(bird.age)} <strong>${formatPrice(bird.price)}</strong></p>
    </article>`).join('');
  renderManagedBirds();
}

const birdFilters = document.querySelector('#bird-filters');
birdFilters.addEventListener('input', renderBirds);
birdFilters.addEventListener('change', renderBirds);
birdFilters.addEventListener('reset', () => requestAnimationFrame(renderBirds));
birdFilters.addEventListener('submit', (event) => event.preventDefault());

function getBirdPhotoPaths(bird) {
  return [bird.image_path, ...birdPhotos
    .filter((photo) => photo.bird_id === bird.id)
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((photo) => photo.image_path)];
}

function selectBirdDialogPhoto(index) {
  if (!activeBirdPhotos.length) return;
  activeBirdPhotoIndex = (index + activeBirdPhotos.length) % activeBirdPhotos.length;
  const activePhoto = activeBirdPhotos[activeBirdPhotoIndex];
  const image = document.querySelector('#bird-dialog-image');
  image.src = publicImageUrl(activePhoto.path);
  image.alt = `${document.querySelector('#bird-dialog-title').textContent}, fotografia ${activeBirdPhotoIndex + 1}`;
  document.querySelectorAll('#bird-dialog-thumbnails button').forEach((button, buttonIndex) => {
    button.classList.toggle('is-active', buttonIndex === activeBirdPhotoIndex);
  });
}

function openBirdDialog(birdId) {
  const bird = birds.find((item) => item.id === birdId);
  if (!bird) return;
  activeBirdPhotos = getBirdPhotoPaths(bird).map((path) => ({ path }));
  activeBirdPhotoIndex = 0;
  document.querySelector('#bird-dialog-species').textContent = bird.species;
  document.querySelector('#bird-dialog-title').textContent = bird.title;
  document.querySelector('#bird-dialog-description').textContent = bird.description;
  document.querySelector('#bird-dialog-sex').textContent = bird.sex;
  document.querySelector('#bird-dialog-age').textContent = bird.age;
  document.querySelector('#bird-dialog-price').textContent = formatPrice(bird.price);
  document.querySelector('#bird-dialog-status').textContent = birdStatusLabel(bird.status);
  const message = `Olá! Tenho interesse na ave ${bird.title}. Pode dar-me mais informações?`;
  document.querySelector('#bird-dialog-whatsapp').href = `https://wa.me/351930693910?text=${encodeURIComponent(message)}`;
  const thumbnails = document.querySelector('#bird-dialog-thumbnails');
  thumbnails.innerHTML = activeBirdPhotos.map((photo, index) => `
    <button type="button" class="${index === 0 ? 'is-active' : ''}" data-bird-photo-index="${index}" aria-label="Ver fotografia ${index + 1}">
      <img src="${publicImageUrl(photo.path)}" alt="">
    </button>`).join('');
  document.querySelector('#bird-photo-previous').hidden = activeBirdPhotos.length < 2;
  document.querySelector('#bird-photo-next').hidden = activeBirdPhotos.length < 2;
  document.querySelector('#bird-dialog').showModal();
  selectBirdDialogPhoto(0);
}

document.querySelector('#bird-dialog-thumbnails').addEventListener('click', (event) => {
  const button = event.target.closest('[data-bird-photo-index]');
  if (button) selectBirdDialogPhoto(Number(button.dataset.birdPhotoIndex));
});
document.querySelector('#bird-photo-previous').addEventListener('click', () => selectBirdDialogPhoto(activeBirdPhotoIndex - 1));
document.querySelector('#bird-photo-next').addEventListener('click', () => selectBirdDialogPhoto(activeBirdPhotoIndex + 1));
document.querySelectorAll('[data-close-bird-dialog]').forEach((button) => {
  button.addEventListener('click', () => document.querySelector('#bird-dialog').close());
});
document.querySelector('#bird-dialog').addEventListener('click', (event) => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});

function renderManagedBirds() {
  if (!isAdmin) return;
  document.querySelector('#managed-birds').innerHTML = birds.map((bird) => `
    <article class="managed-item"><img src="${publicImageUrl(bird.image_path)}" alt="" loading="lazy"><div><strong>${escapeHtml(bird.title)}</strong><span>${escapeHtml(bird.species)} · ${formatPrice(bird.price)} · ${birdStatusLabel(bird.status)}</span></div>
      <button class="text-button" type="button" data-edit-bird="${escapeHtml(bird.id)}">Editar</button><button class="text-button danger-button" type="button" data-delete-bird="${escapeHtml(bird.id)}">Apagar</button>
    </article>`).join('');
}

function renderFacilities() {
  document.querySelector('#facility-empty').hidden = facilities.length > 0;
  document.querySelector('#facility-grid').innerHTML = facilities.map((facility, index) => `
    <figure class="facility-photo ${index === 0 ? 'facility-main' : ''}"><img src="${publicImageUrl(facility.image_path)}" alt="${escapeHtml(facility.caption)}" loading="lazy"><figcaption>${escapeHtml(facility.caption)}</figcaption></figure>`).join('');
  if (!isAdmin) return;
  document.querySelector('#managed-facilities').innerHTML = facilities.map((facility) => `
    <article class="managed-item"><img src="${publicImageUrl(facility.image_path)}" alt="" loading="lazy"><div><strong>${escapeHtml(facility.caption)}</strong></div><button class="text-button danger-button" type="button" data-delete-facility="${escapeHtml(facility.id)}">Apagar</button></article>`).join('');
}

async function loadContent() {
  if (!supabaseClient) return;
  const [birdResult, facilityResult, imageResult, photoResult] = await Promise.all([
    supabaseClient.from('birds').select('*').order('created_at', { ascending: true }),
    supabaseClient.from('facilities').select('*').order('created_at', { ascending: true }),
    supabaseClient.from('site_images').select('*'),
    supabaseClient.from('bird_photos').select('*').order('sort_order', { ascending: true })
  ]);
  if (birdResult.error) throw birdResult.error;
  if (facilityResult.error) throw facilityResult.error;
  if (imageResult.error) throw imageResult.error;
  birds = birdResult.data || [];
  facilities = facilityResult.data || [];
  birdMutationColumnAvailable = birds.length === 0 || Object.hasOwn(birds[0], 'mutation');
  const missingPhotoTable = photoResult.error && ['PGRST205', '42P01'].includes(photoResult.error.code);
  if (photoResult.error && !missingPhotoTable) throw photoResult.error;
  birdPhotoTableAvailable = !missingPhotoTable;
  let missingStatusColumn = false;
  let missingMutationColumn = false;
  if (isAdmin) {
    const [{ error: statusError }, { error: mutationError }] = await Promise.all([
      supabaseClient.from('birds').select('status').limit(1),
      supabaseClient.from('birds').select('mutation').limit(1)
    ]);
    missingStatusColumn = statusError && ['PGRST204', '42703'].includes(statusError.code);
    if (statusError && !missingStatusColumn) throw statusError;
    missingMutationColumn = mutationError && ['PGRST204', '42703'].includes(mutationError.code);
    if (mutationError && !missingMutationColumn) throw mutationError;
  }
  birdStatusColumnAvailable = !missingStatusColumn;
  birdMutationColumnAvailable = !missingMutationColumn && (birds.length === 0 || Object.hasOwn(birds[0], 'mutation'));
  document.querySelector('#bird-status').disabled = missingStatusColumn;
  document.querySelector('#bird-mutation').disabled = missingMutationColumn;
  document.querySelector('#filter-mutation').disabled = birds.length > 0 && !birdMutationColumnAvailable;
  if (missingStatusColumn && isAdmin) {
    setStatus('Para gerir a disponibilidade, execute SUPABASE_BIRD_STATUS.sql no Supabase.', true);
  }
  if (missingMutationColumn && isAdmin) {
    setStatus('Para filtrar e editar mutações, execute SUPABASE_BIRD_MUTATION.sql no Supabase.', true);
  }
  birdPhotos = photoResult.data || [];
  if (missingPhotoTable && isAdmin) {
    setStatus('Para guardar fotografias adicionais, execute SUPABASE_BIRD_PHOTOS.sql no Supabase.', true);
  }
  refreshBirdFilters();
  renderBirds();
  renderFacilities();

  const imageRows = imageResult.data || [];
  const coverRows = imageRows.filter((image) => image.id === 'cover' || image.id.startsWith('cover-'))
    .sort((left, right) => {
      const leftOrder = left.id === 'cover' ? 0 : Number(left.id.replace(/^cover-/, '')) || 9999;
      const rightOrder = right.id === 'cover' ? 0 : Number(right.id.replace(/^cover-/, '')) || 9999;
      return leftOrder - rightOrder;
    });
  const images = Object.fromEntries(imageRows.map((image) => [image.id, image.image_path]));
  homeCoverImages = coverRows.map((image) => publicImageUrl(image.image_path));
  homeCoverIndex = 0;
  const coverPreview = document.querySelector('#cover-preview');
  const counter = document.querySelector('#cover-counter');
  const hasCover = homeCoverImages.length > 0;

  if (homeCoverTimer) {
    clearInterval(homeCoverTimer);
    homeCoverTimer = null;
  }

  function updateHomeCoverSlide() {
    if (!homeCoverImages.length) {
      if (coverImage) coverImage.hidden = true;
      if (coverPlaceholder) coverPlaceholder.hidden = true;
      if (counter) counter.textContent = '01 / 01';
      return;
    }

    if (coverImage) coverImage.hidden = false;
    if (coverPlaceholder) coverPlaceholder.hidden = true;
    if (coverImage) coverImage.src = homeCoverImages[homeCoverIndex];
    if (counter) counter.textContent = `${String((homeCoverIndex + 1)).padStart(2, '0')} / ${String(homeCoverImages.length).padStart(2, '0')}`;
    if (isAdmin) {
      coverPreview.src = coverImage.src;
      coverPreview.hidden = false;
    }
  }

  updateHomeCoverSlide();

  if (homeCoverImages.length > 1) {
    homeCoverTimer = window.setInterval(() => {
      homeCoverIndex = (homeCoverIndex + 1) % homeCoverImages.length;
      updateHomeCoverSlide();
    }, 10000);
  }

  const hasCustomLogo = Boolean(images.logo);
  const logoSource = hasCustomLogo ? publicImageUrl(images.logo) : 'brand-logo.svg';

  if (brandLogo) {
    brandLogo.src = logoSource;
    brandLogo.hidden = false;
  }
  document.querySelector('#brand-mark').hidden = true;
  document.querySelector('.brand-name').hidden = true;
  document.querySelector('.brand').classList.toggle('has-custom-logo', hasCustomLogo);

  if (isAdmin && images.logo) {
    const logoPreview = document.querySelector('#logo-preview');
    logoPreview.src = brandLogo.src;
    logoPreview.hidden = false;
  }
}

async function uploadImage(file) {
  if (!isAdmin) throw new Error('Apenas uma conta autorizada pode alterar imagens.');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabaseClient.storage.from(imageBucket).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

async function deleteImage(path) {
  if (!path) return;
  const { error } = await supabaseClient.storage.from(imageBucket).remove([path]);
  if (error) throw error;
}

function resetBirdForm() {
  const form = document.querySelector('#bird-form');
  form.reset();
  editingBird = null;
  document.querySelector('#bird-image').required = true;
  document.querySelector('#bird-image-preview').hidden = true;
  document.querySelector('#bird-extra-preview').replaceChildren();
  document.querySelector('#bird-existing-photos').replaceChildren();
  document.querySelector('#bird-form-title').textContent = 'Adicionar ave';
  document.querySelector('#bird-submit').innerHTML = 'Guardar ave <span aria-hidden="true">↗</span>';
  document.querySelector('#bird-cancel').hidden = true;
}

document.querySelector('#bird-extra-images').addEventListener('change', (event) => {
  const preview = document.querySelector('#bird-extra-preview');
  preview.replaceChildren();
  [...event.currentTarget.files].forEach((file) => {
    if (!file.type.startsWith('image/')) return;
    const image = document.createElement('img');
    image.src = URL.createObjectURL(file);
    image.alt = file.name;
    preview.append(image);
  });
});

function renderExistingBirdPhotos(bird) {
  const container = document.querySelector('#bird-existing-photos');
  const photos = birdPhotos.filter((photo) => photo.bird_id === bird.id);
  container.innerHTML = photos.map((photo) => `
    <button type="button" class="existing-photo" data-delete-bird-photo="${escapeHtml(photo.id)}" aria-label="Remover fotografia">
      <img src="${publicImageUrl(photo.image_path)}" alt=""><span aria-hidden="true">×</span>
    </button>`).join('');
}

document.querySelector('#bird-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isAdmin) return;
  const form = new FormData(event.currentTarget);
  const selectedImage = form.get('image');
  const extraFiles = [...document.querySelector('#bird-extra-images').files];
  let imagePath = editingBird?.image_path;
  let uploadedPaths = [];
  try {
    if (extraFiles.length && !birdPhotoTableAvailable) {
      throw new Error('Execute SUPABASE_BIRD_PHOTOS.sql antes de guardar fotografias adicionais.');
    }
    if (selectedImage.size) imagePath = await uploadImage(selectedImage);
    if (extraFiles.some((file) => !file.type.startsWith('image/'))) throw new Error('Selecione apenas ficheiros de imagem.');
    const record = {
      title: form.get('title').trim(), species: form.get('species').trim(),
      sex: form.get('sex'), age: form.get('age').trim(),
      description: form.get('description').trim(), price: Number(form.get('price')),
      image_path: imagePath
    };
    if (birdStatusColumnAvailable) record.status = form.get('status');
    if (birdMutationColumnAvailable) record.mutation = form.get('mutation').trim() || null;
    const result = editingBird
      ? await supabaseClient.from('birds').update(record).eq('id', editingBird.id).select('id').single()
      : await supabaseClient.from('birds').insert(record).select('id').single();
    if (result.error) throw result.error;
    const birdId = result.data.id;
    for (const file of extraFiles) uploadedPaths.push(await uploadImage(file));
    if (uploadedPaths.length) {
      const nextOrder = birdPhotos.filter((photo) => photo.bird_id === birdId).length;
      const { error } = await supabaseClient.from('bird_photos').insert(uploadedPaths.map((path, index) => ({
        bird_id: birdId, image_path: path, sort_order: nextOrder + index
      })));
      if (error) throw error;
    }
    if (selectedImage.size && editingBird?.image_path) await deleteImage(editingBird.image_path);
    await loadContent();
    resetBirdForm();
    setStatus('Ave guardada.');
  } catch (error) {
    await Promise.all(uploadedPaths.map((path) => deleteImage(path).catch(() => {})));
    setStatus(`Não foi possível guardar a ave: ${error.message}`, true);
  }
});

document.querySelector('#bird-cancel').addEventListener('click', resetBirdForm);
document.querySelector('#managed-birds').addEventListener('click', async (event) => {
  if (!isAdmin) return;
  const editButton = event.target.closest('[data-edit-bird]');
  const deleteButton = event.target.closest('[data-delete-bird]');
  const deletePhotoButton = event.target.closest('[data-delete-bird-photo]');
  if (deletePhotoButton) {
    const photo = birdPhotos.find((item) => item.id === deletePhotoButton.dataset.deleteBirdPhoto);
    if (!photo) return;
    try {
      const { error } = await supabaseClient.from('bird_photos').delete().eq('id', photo.id);
      if (error) throw error;
      await deleteImage(photo.image_path);
      await loadContent();
      const bird = birds.find((item) => item.id === photo.bird_id);
      if (bird) renderExistingBirdPhotos(bird);
    } catch (error) {
      setStatus(`Não foi possível remover a fotografia: ${error.message}`, true);
    }
    return;
  }
  if (editButton) {
    editingBird = birds.find((bird) => bird.id === editButton.dataset.editBird);
    const form = document.querySelector('#bird-form');
    ['title', 'species', 'sex', 'age', 'description', 'price', 'status'].forEach((field) => {
      form.elements[field].value = editingBird[field];
    });
    document.querySelector('#bird-mutation').value = birdMutationColumnAvailable ? editingBird.mutation || '' : '';
    document.querySelector('#bird-image').required = false;
    document.querySelector('#bird-image-preview').src = publicImageUrl(editingBird.image_path);
    document.querySelector('#bird-image-preview').hidden = false;
    renderExistingBirdPhotos(editingBird);
    document.querySelector('#bird-form-title').textContent = 'Editar ave';
    document.querySelector('#bird-submit').innerHTML = 'Guardar alterações <span aria-hidden="true">↗</span>';
    document.querySelector('#bird-cancel').hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (deleteButton && window.confirm('Apagar esta ave do catálogo?')) {
    const bird = birds.find((item) => item.id === deleteButton.dataset.deleteBird);
    try {
      const { error } = await supabaseClient.from('birds').delete().eq('id', bird.id);
      if (error) throw error;
      const imagePaths = [bird.image_path, ...birdPhotos.filter((photo) => photo.bird_id === bird.id).map((photo) => photo.image_path)];
      await Promise.all(imagePaths.map((path) => deleteImage(path)));
      await loadContent();
      setStatus('Ave apagada.');
    } catch (error) {
      setStatus(`Não foi possível apagar a ave: ${error.message}`, true);
    }
  }
});

const identityForm = document.querySelector('#identity-form');
if (identityForm) {
  identityForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isAdmin) return;

    const coverInput = document.querySelector('#cover-file');
    const logoInput = document.querySelector('#logo-file');
    if (!coverInput || !logoInput) {
      setStatus('O formulário de identidade ainda não está disponível.', true);
      return;
    }

    const coverFiles = [...coverInput.files].filter((file) => file && file.type.startsWith('image/'));
    const logoFile = logoInput.files[0];

    try {
      const currentRows = (await supabaseClient.from('site_images').select('*')).data || [];
      const coverRows = currentRows.filter((image) => image.id === 'cover' || image.id.startsWith('cover-'));
      const logoRow = currentRows.find((image) => image.id === 'logo');

      for (const row of coverRows) {
        await deleteImage(row.image_path);
      }
      for (const row of coverRows) {
        const { error: deleteError } = await supabaseClient.from('site_images').delete().eq('id', row.id);
        if (deleteError) throw deleteError;
      }

      const uploadedCoverPaths = [];
      for (const [index, file] of coverFiles.entries()) {
        const path = await uploadImage(file);
        uploadedCoverPaths.push({ id: index === 0 ? 'cover' : `cover-${index + 1}`, image_path: path });
      }

      if (uploadedCoverPaths.length) {
        const { error: coverError } = await supabaseClient.from('site_images').upsert(uploadedCoverPaths);
        if (coverError) throw coverError;
      }

      if (logoFile) {
        const path = await uploadImage(logoFile);
        const { error: logoInsertError } = await supabaseClient.from('site_images').upsert({ id: 'logo', image_path: path });
        if (logoInsertError) throw logoInsertError;
        if (logoRow?.image_path) await deleteImage(logoRow.image_path);
      }

      if (!logoFile && logoRow) {
        await deleteImage(logoRow.image_path);
        await supabaseClient.from('site_images').delete().eq('id', 'logo');
      }

      await loadContent();
      identityForm.reset();
      setStatus('Identidade do site guardada.');
    } catch (error) {
      setStatus(`Não foi possível guardar as imagens: ${error.message}`, true);
    }
  });
}

document.querySelector('#facility-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isAdmin) return;
  const image = document.querySelector('#facility-file').files[0];
  const caption = document.querySelector('#facility-caption').value.trim();
  try {
    const imagePath = await uploadImage(image);
    const { error } = await supabaseClient.from('facilities').insert({ caption, image_path: imagePath });
    if (error) throw error;
    event.currentTarget.reset();
    document.querySelector('#facility-preview').hidden = true;
    await loadContent();
    setStatus('Fotografia adicionada.');
  } catch (error) {
    setStatus(`Não foi possível adicionar a fotografia: ${error.message}`, true);
  }
});

document.querySelector('#managed-facilities').addEventListener('click', async (event) => {
  if (!isAdmin) return;
  const button = event.target.closest('[data-delete-facility]');
  if (!button || !window.confirm('Apagar esta fotografia das instalações?')) return;
  const facility = facilities.find((item) => item.id === button.dataset.deleteFacility);
  try {
    const { error } = await supabaseClient.from('facilities').delete().eq('id', facility.id);
    if (error) throw error;
    await deleteImage(facility.image_path);
    await loadContent();
    setStatus('Fotografia apagada.');
  } catch (error) {
    setStatus(`Não foi possível apagar a fotografia: ${error.message}`, true);
  }
});

document.querySelector('#admin-login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = document.querySelector('#admin-login-status');
  if (!supabaseClient) {
    status.textContent = 'A autenticação ainda não está configurada.';
    return;
  }
  const form = new FormData(event.currentTarget);
  status.textContent = 'A verificar acesso…';
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: form.get('email'), password: form.get('password')
    });
    if (error) throw error;
    if (!await checkAdmin(data.user)) {
      await supabaseClient.auth.signOut();
      throw new Error('Esta conta não tem autorização para gerir o catálogo.');
    }
    await enableAdmin();
  } catch (error) {
    status.textContent = error.message;
  }
});

document.querySelector('#admin-logout').addEventListener('click', async () => {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  removeManagementTab();
  if (adminRequested) showLoginScreen();
});

document.querySelector('#contact-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const subject = encodeURIComponent(`Contacto de ${form.get('nome')} | Passarinhos da Fonte Longa`);
  const body = encodeURIComponent(`Nome: ${form.get('nome')}\nEmail: ${form.get('email')}\n\n${form.get('mensagem')}`);
  window.location.href = `mailto:rodriguesjoao265ar@gmail.com?subject=${subject}&body=${body}`;
});

async function boot() {
  document.querySelector('#year').textContent = new Date().getFullYear();
  if (adminRequested) showLoginScreen();
  if (!supabaseClient) {
    if (adminRequested) document.querySelector('#admin-login-status').textContent = 'A autenticação ainda não está configurada.';
    renderBirds();
    renderFacilities();
    return;
  }

  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') removeManagementTab();
  });

  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (data.session && await checkAdmin(data.session.user)) {
      isAdmin = true;
      addManagementTab();
      showPublicPage();
    }
    await loadContent();
    if (isAdmin && adminRequested) {
      history.replaceState(null, '', window.location.pathname);
      activateTab('gestao');
    }
  } catch (error) {
    setStatus(`Não foi possível ligar ao catálogo: ${error.message}`, true);
    renderBirds();
    renderFacilities();
  }
}

boot();
