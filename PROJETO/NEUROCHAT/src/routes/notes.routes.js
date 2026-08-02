const express = require('express');
const router = express.Router();
const notesController = require('../controllers/notesController');

// Rotas do Bloco de Notas Pessoal
router.get('/api/notes', notesController.getUserNotes);
router.post('/api/notes', notesController.createNote);
router.put('/api/notes/:id', notesController.updateNote);
router.put('/api/notes/:id/pin', notesController.togglePin);
router.delete('/api/notes/:id', notesController.deleteNote);

module.exports = router;
