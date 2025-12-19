<template>
  <section>
    <base-card>
      <the-breadcrumb :crumbs="breadcrumbs"></the-breadcrumb>
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
import TheBreadcrumb from '../../components/ui/TheBreadcrumb.vue';

export default {
  components: {
    GameForm,
    TheBreadcrumb
  },
  data() {
    return {
      gameData: null,
      isEdit: false,
      isLoading: true,
      gamingGroupId: null,
      gamingGroupName: null
    };
  },
  computed: {
    gamingGroups() {
      return this.$store.getters['gamingGroups/groups'];
    },
    breadcrumbs() {
      const crumbs = [{ label: 'Gaming Groups', to: '/gaming-groups' }];
      if (this.gamingGroupName && this.gamingGroupId) {
        crumbs.push({ label: this.gamingGroupName, to: `/gaming-groups/${this.gamingGroupId}` });
      }
      crumbs.push({ label: this.isEdit ? 'Edit Game' : 'Add Game' });
      return crumbs;
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
          this.gamingGroupId = game.gamingGroupId;
          // Get gaming group name
          const group = this.gamingGroups.find(g => g.id === game.gamingGroupId);
          this.gamingGroupName = group ? group.name : 'Group';
        } else {
          this.$router.replace('/gaming-groups');
        }
      } catch (error) {
        this.$router.replace('/gaming-groups');
      }
    } else if (groupId) {
      // Pre-select gaming group when coming from group page
      this.gamingGroupId = parseInt(groupId);
      const group = this.gamingGroups.find(g => g.id === this.gamingGroupId);
      this.gamingGroupName = group ? group.name : 'Group';
      this.gameData = {
        gamingGroupId: this.gamingGroupId
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
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Navigate back to gaming group
        const groupId = data.gamingGroupId || this.gamingGroupId;
        if (groupId) {
          this.$router.replace(`/gaming-groups/${groupId}`);
        } else {
          this.$router.replace('/gaming-groups');
        }
      } catch (error) {
        console.error('Error saving game:', error);
        alert(error.message || 'Failed to save game');
      }
    }
  }
};
</script>
