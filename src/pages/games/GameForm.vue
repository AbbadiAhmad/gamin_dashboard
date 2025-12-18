<template>
  <section>
    <base-card>
      <h2>{{ isEdit ? 'Edit' : 'Add' }} Game</h2>
      <game-form
        v-if="!isLoading"
        :is-edit="isEdit"
        :game-data="gameData"
        :gaming-groups="gamingGroups"
        @save-data="saveData"
      ></game-form>
      <base-spinner v-else></base-spinner>
    </base-card>
  </section>
</template>

<script>
import GameForm from '../../components/games/GameForm.vue';

export default {
  components: {
    GameForm,
  },
  data() {
    return {
      gameData: null,
      isEdit: false,
      isLoading: true,
    };
  },
  computed: {
    gamingGroups() {
      return this.$store.getters['gamingGroups/groups'];
    }
  },
  async created() {
    // Load gaming groups first
    try {
      await this.$store.dispatch('gamingGroups/loadGroups');
    } catch (error) {
      console.error('Failed to load gaming groups:', error);
    }

    const gameId = this.$route.params.id;
    const groupId = this.$route.query.groupId;

    if (gameId) {
      this.isEdit = true;
      try {
        await this.$store.dispatch('games/loadGames', { forceRefresh: true });
        const game = this.$store.getters['games/getGameById'](parseInt(gameId));
        if (game) {
          this.gameData = { ...game };
        } else {
          this.$router.replace('/games');
        }
      } catch (error) {
        this.$router.replace('/games');
      }
    } else if (groupId) {
      // Pre-select gaming group when coming from group page
      this.gameData = {
        gamingGroupId: parseInt(groupId)
      };
    }
    this.isLoading = false;
  },
  methods: {
    async saveData(data) {
      try {
        if (this.isEdit) {
          await this.$store.dispatch('games/updateGame', {
            id: this.$route.params.id,
            ...data
          });
        } else {
          await this.$store.dispatch('games/createGame', data);
        }
        this.$router.replace('/games');
      } catch (error) {
        console.error('Error saving game:', error);
        alert(error.message || 'Failed to save game');
      }
    }
  }
};
</script>
